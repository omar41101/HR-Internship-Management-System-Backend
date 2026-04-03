import User from "../models/User.js";
import Department from "../models/Department.js";
import Attendance from "../models/Attendance.js";
import Timetable from "../models/Timetable.js";
import UserRole from "../models/UserRole.js";
import { io } from "../server.js";
import crypto from "crypto";

import { buildDateFilter } from "../utils/dateFilter.js";
import {
  exportCSV,
  exportExcel,
  sanitize,
  getPeriodLabel,
} from "../utils/exportHelpers.js";
import { exportAttendanceStats } from "../services/attendanceExportService.js";

// The company location (For the location check-in)
const COMPANY_LOCATION = {
  lat: 51.5271,
  lng: -0.0896,
};

// Function to calculate distance in meters between two coordinates
const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters
  const toRad = (x) => (x * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const FACE_NONCE_TTL_MS = 30 * 1000;
const FACE_CLOCK_SKEW_MS = 30 * 1000;
const FACE_ATTESTATION_SECRET = process.env.FACE_ATTESTATION_SECRET || "";
const faceNonceStore = new Map();

const nonceKey = (userId, nonce) => `${String(userId)}:${String(nonce)}`;

const purgeExpiredFaceChallenges = () => {
  const now = Date.now();
  for (const [key, value] of faceNonceStore.entries()) {
    if (!value || value.expiresAt <= now || value.used === true) {
      faceNonceStore.delete(key);
    }
  }
};

const signablePayloadString = (payload) => {
  return JSON.stringify(
    {
      nonce: String(payload.nonce),
      result: String(payload.result),
      timestamp: Number(payload.timestamp),
      userId: String(payload.userId),
    }
  );
};

const safeEqualHex = (a, b) => {
  try {
    const ba = Buffer.from(String(a || ""), "hex");
    const bb = Buffer.from(String(b || ""), "hex");
    if (ba.length !== bb.length || ba.length === 0) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
};

const verifyFaceProof = (jwtUserId, faceProof) => {
  if (!FACE_ATTESTATION_SECRET) return { ok: false, message: "Face attestation secret is not configured" };
  if (!faceProof || typeof faceProof !== "object") return { ok: false, message: "Missing faceProof" };

  const payload = faceProof.payload;
  const signature = faceProof.signature;
  if (!payload || !signature) return { ok: false, message: "Invalid faceProof format" };

  if (String(payload.userId) !== String(jwtUserId)) {
    return { ok: false, message: "Face proof user mismatch" };
  }
  if (String(payload.result) !== "success") {
    return { ok: false, message: "Face proof result is not success" };
  }

  const now = Date.now();
  const tsMs = Number(payload.timestamp) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(now - tsMs) > FACE_CLOCK_SKEW_MS) {
    return { ok: false, message: "Face proof is expired or not yet valid" };
  }

  const expectedSig = crypto
    .createHmac("sha256", FACE_ATTESTATION_SECRET)
    .update(signablePayloadString(payload))
    .digest("hex");

  if (!safeEqualHex(expectedSig, signature)) {
    return { ok: false, message: "Invalid face proof signature" };
  }

  purgeExpiredFaceChallenges();
  const key = nonceKey(jwtUserId, payload.nonce);
  const challenge = faceNonceStore.get(key);
  if (!challenge) return { ok: false, message: "Face challenge not found or expired" };
  if (challenge.used) return { ok: false, message: "Face challenge already used" };
  if (challenge.expiresAt <= now) {
    faceNonceStore.delete(key);
    return { ok: false, message: "Face challenge expired" };
  }

  challenge.used = true;
  challenge.usedAt = now;
  faceNonceStore.set(key, challenge);
  return { ok: true };
};

export const createFaceChallenge = async (req, res, next) => {
  try {
    const userId = req.user._id;
    purgeExpiredFaceChallenges();

    const nonce = crypto.randomBytes(24).toString("hex");
    const now = Date.now();
    const key = nonceKey(userId, nonce);
    faceNonceStore.set(key, {
      userId: String(userId),
      nonce,
      createdAt: now,
      expiresAt: now + FACE_NONCE_TTL_MS,
      used: false,
      usedAt: null,
    });

    return res.status(200).json({
      status: "success",
      result: {
        nonce,
        expiresInMs: FACE_NONCE_TTL_MS,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Helper to get start of day in UTC
const getStartOfDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// Helper to get end of day in UTC
const getEndOfDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
};

// Check-in function
export const checkIn = async (req, res, next) => {
  try {
    // Get the user ID
    const userId = req.user._id;
    const { latitude, longitude, faceProof } = req.body || {}; 

    // Face validation (Required for every check-in)
    const faceValidation = verifyFaceProof(userId, faceProof);
    if (!faceValidation.ok) {
      return res.status(401).json({
        status: "Error",
        message: faceValidation.message,
      });
    }

    const now = new Date();
    const todayUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ));

    // Get the user's existance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "Error",
        message: "User not found!",
      });
    }

    // See if the user has his face enrolled (For facial recognition check-in)
    if (!user.faceEnrolled) {
      return res.status(403).json({
        status: "Error",
        message: "Face not enrolled! Please enroll your face before your check-in!",
      });
    }

    // Get the user's shift for today to determine if they are late
    const shift = await Timetable.findOne({
      userId,
      date: {
        $gte: todayUTC,
        $lt: new Date(todayUTC.getTime() + 86400000),
      },
    });
    if(!shift) {
      return res.status(404).json({
        status: "Error",
        message: "No shift found for today!",
      });
    }

    // Determine the supposed location
    let locationStatus = "Remote"; // The Default location
    if (shift.location === "Onsite") {
      if (!latitude || !longitude) {
        return res.status(400).json({
          status: "Error",
          message: "User location required for onsite shift!",
        });
      }

      const distance = getDistanceInMeters(latitude, longitude, COMPANY_LOCATION.lat, COMPANY_LOCATION.lng);
      const MAX_DISTANCE_METERS = 200;
      locationStatus = distance <= MAX_DISTANCE_METERS ? "Onsite" : "Remote";
    }

    // Check the presence status of the user based on the shift
    let status = "present";
    if (shift && shift.startTime) {
      // Convert shift startTime to a Date
      const [startHour, startMinute] = shift.startTime.split(":").map(Number);

      const shiftStart = new Date(todayUTC);
      shiftStart.setUTCHours(startHour, startMinute, 0, 0);

      // Apply grace period
      const grace = shift.gracePeriod || 15;
      const lateThreshold = new Date(shiftStart.getTime() + grace * 60000);

      if (now > lateThreshold) {
        status = "late";
      }
    }

    // Create or update attendance record
    const attendance = await Attendance.findOneAndUpdate(
      { userId, date: todayUTC },
      {
        checkInTime: now,
        status,
        location: { latitude, longitude },
        workLocation: locationStatus,
        checkOutTime: null,
      },
      { upsert: true, returnDocument: 'after' },
    );

    // Emit (Sends a message) real-time event to all connected clients
    io.emit("attendanceUpdated", {
      action: "checkIn",
      userId: String(userId),
      attendance,
    });

    res.status(200).json({
      status: "success",
      message: "Checked in successfully!",
      result: attendance,
    });
  } catch (error) {
    next(error);
  }
};

// Get the user's attendance status for today
export const getMyStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const today = getStartOfDay(new Date());

    // Check the user's existance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "Error",
        message: "User not found!",
      });
    }

    // Get today's attendance record for the user
    const attendance = await Attendance.findOne({ userId, date: today });
    if (!attendance) {
      return res.status(200).json({
        status: "success",
        message:
          "No attendance record found for today. You haven't checked in yet!",
        result: null,
      });
    }

    res.status(200).json({
      status: "success",
      result: attendance,
    });
  } catch (error) {
    next(error);
  }
};

// Get attendance records (Admin/Supervisor)
export const getAttendance = async (req, res, next) => {
  try {
    const { 
      userId, 
      startDate, 
      endDate, 
      status, 
      role, 
      department, 
      search,
      page = 1, 
      limit: queryLimit, // [PAGINATION-FIX]
    } = req.query;

    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const limit = Math.min(parseInt(queryLimit) || 10, 9999); // [PAGINATION-FIX] Respect requested limit up to 9999
    const skip = (parsedPage - 1) * limit;

    const filter = {}; // Allow filtering

    // Check for user existance if userId is provided
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          status: "Error",
          message: "User not found!",
        });
      }
    }

    // Authorization & checking the Identity
    if (req.user.role.name === "Admin" || req.user.role.name === "Supervisor") {
      if (userId) filter.userId = userId;
    } else {
      filter.userId = req.user._id;
    }

    // Date Filtering
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = getStartOfDay(startDate);
      if (endDate) filter.date.$lte = getEndOfDay(endDate);
    }

    // Status filtering
    if (status) {
      filter.status = status;
    }

    // SEARCH & FILTER CONFIGURATION (on Users)
    const userFilter = {};
    if (search) {
      userFilter.$or = [
        { name: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (role) {
      const roleDoc = await UserRole.findOne({ name: { $regex: `^${role}$`, $options: "i" } });
      if (roleDoc) userFilter.role_id = roleDoc._id;
    }

    if (department) {
      const deptDoc = await Department.findOne({ name: { $regex: `^${department}$`, $options: "i" } });
      if (deptDoc) userFilter.department_id = deptDoc._id;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // [ATTENDANCE-FIX] New 'User-Centric' Daily Summary Logic (Left Join)
    // ──────────────────────────────────────────────────────────────────────────
    if (req.query.forSummary === "true") {
      const totalUsers = await User.countDocuments(userFilter);
      
      const pagedUsers = await User.find(userFilter)
        .populate("role_id", "name")
        .populate("department_id", "name")
        .populate("supervisor_id", "name lastName")
        .skip(skip)
        .limit(limit)
        .lean();

      // Find attendance records for these specific users on the target date
      const attendanceFilter = {
  date: {
    $gte: getStartOfDay(startDate),
    $lte: getEndOfDay(endDate),
  },
};
      const userIds = pagedUsers.map(u => u._id);
      attendanceFilter.userId = { $in: userIds };

      const records = await Attendance.find(attendanceFilter)
  .populate({
    path: "userId",
    populate: [
      { path: "role_id", select: "name" },
      { path: "department_id", select: "name" },
      { path: "supervisor_id", select: "name lastName" },
    ],
  })
  .lean();


      // Map attendance onto the users (Left Join)
      const mappedResults = pagedUsers.map(user => {
        const record = records.find(r => r.userId.toString() === user._id.toString());
return record || {
  userId: {
    _id: user._id,
    name: user.name,
    lastName: user.lastName,
    email: user.email,
    role_id: user.role_id,
    department_id: user.department_id,
    supervisor_id: user.supervisor_id,
  },
  date: getStartOfDay(startDate),
  status: "absent",
  checkInTime: null,
  checkOutTime: null,
  workLocation: null,
  isImplicit: true,
};
      });

      // Special handling: if we return the user object inside 'userId', it matches 'populate' format
      const finalResults = mappedResults.map(res => {
        if (res.isImplicit) {
          // Flatten user if already populated
          return res;
        }
        // For real records, we need to populate userId manually if not already (though we didn't populate it in find(filter) above)
        // Actually, for consistency, let's keep the user object in 'userId'
        return res;
      });

      // Mandatory Logging
      // [DEBUG-ATTENDANCE] Total users: X | Users with attendance: Y | Date: selectedDate
      console.log(`[DEBUG-ATTENDANCE] Total users: ${totalUsers} | Users with attendance: ${records.length} | Page: ${parsedPage} | Date: ${startDate}`);

      return res.status(200).json({
        status: "Success",
        page: parsedPage,
        limit: limit,
        totalRecords: totalUsers, // Total pages based on USER count
        totalPages: Math.ceil(totalUsers / limit),
        results: finalResults.length,
        result: finalResults,
      });
    }

    // ─── Standard 'Record-Centric' Logic (For History / Calendar) ───────────────────
    
    // Search for users matching the userFilter criteria and get their IDs
    let userIds = null;
    if (Object.keys(userFilter).length > 0) {
      const users = await User.find(userFilter).select("_id");
      userIds = users.map((u) => u._id);

      // If no users match, then we return an empty result
      if (userIds.length === 0) {
        return res.status(200).json({
          status: "Success",
          page: parsedPage,
          totalPages: 0,
          totalRecords: 0,
          result: [],
        });
      }

      if (filter.userId && !Array.isArray(filter.userId)) {
  // A specific userId was already set — check if it's in the matched set
  const specificId = filter.userId.toString();
  const inSet = userIds.some(id => id.toString() === specificId);
  if (!inSet) {
    return res.status(200).json({
      status: "Success",
      page: parsedPage,
      totalPages: 0,
      totalRecords: 0,
      result: [],
    });
  }
  // else: keep filter.userId as the specific ID (more precise than $in)
} else {
  filter.userId = { $in: userIds };
}
    }

    // Get total count for pagination
    const totalRecords = await Attendance.countDocuments(filter);

    // Get attendance records
    const attendanceRecords = await Attendance.find(filter)
      .populate({
        path: "userId",
        populate: [
          { path: "role_id", select: "name" },
          { path: "department_id", select: "name" },
        ],
      })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // [PAGINATION-DEBUG] Added log to track backend output
    console.log(`[PAGINATION] Module: Attendance | Page: ${parsedPage || 1} | Limit: ${limit || 10} | Returned: ${attendanceRecords?.length || 0} records`);

    res.status(200).json({
      status: "Success",
      page: parsedPage,
      limit: limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      results: attendanceRecords.length,
      result: attendanceRecords,
    });
  } catch (error) {
    next(error);
  }
};

// Get the list of statuses (Admin/Supervisor)
export const getAllStatuses = async (req, res, next) => {
  try {
    // Get distinct existing statuses from the Attendance collection
    const existingStatuses = await Attendance.distinct("status");

    // All possible statuses
    const allStatuses = ["present", "late", "absent", "leave", "day-off"];

    // Filter duplicate statuses
    const statuses = allStatuses
      .filter((s) => !existingStatuses.includes(s))
      .concat(existingStatuses);

    res.status(200).json({
      status: "success",
      result: statuses,
    });
  } catch (error) {
    next(error);
  }
};

// Admin updates attendance record directly
export const updateAttendance = async (req, res, next) => {
  try {
    const { id } = req.params; // Attendance record ID
    const updates = req.body;

    const attendance = await Attendance.findByIdAndUpdate(id, updates, {
      new: true,
    });

    if (!attendance) {
      return res.status(404).json({
        status: "Error",
        message: "Attendance record not found!",
      });
    }

    // Emit real-time event for admin updates too
    io.emit("attendanceUpdated", {
      action: "adminUpdate",
      attendance,
    });

    res.status(200).json({
      status: "success",
      result: attendance,
      message: "Attendance updated successfully!",
    });
  } catch (error) {
    next(error);
  }
};

// Check-out
export const checkOut = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const utcNow = new Date(
      Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds(),
      ),
    );

    const todayUTC = new Date(
      Date.UTC(
        utcNow.getUTCFullYear(),
        utcNow.getUTCMonth(),
        utcNow.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );

    // Check the user's existance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "Error",
        message: "User not found!",
      });
    }

    const checkOutTime = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const attendance = await Attendance.findOneAndUpdate(
      { userId, date: todayUTC },
      { checkOutTime: utcNow.toISOString() },
      { new: true },
    );

    if (!attendance) {
      return res.status(404).json({
        status: "Error",
        message: "No attendance record found for today. Did you check in?",
      });
    }

    // Emit real-time event to all connected clients
    io.emit("attendanceUpdated", {
      action: "checkOut",
      userId: String(userId),
      attendance,
    });

    res.status(200).json({
      status: "success",
      result: attendance,
      message: "Checked out successfully!",
    });
  } catch (error) {
    next(error);
  }
};

// Export the attendance records of a precise user to CSV/Excel (Admin Only)
export const exportUserAttendance = async (req, res, next) => {
  try {
    const {
      userName,
      userLastName,
      userEmail,
      type,
      year,
      month,
      trimester,
      format,
      startDate,
      endDate,
    } = req.query;

    // Validate user existance
    const user = await User.findOne({
      name: userName,
      lastName: userLastName,
      email: userEmail,
    });
    if (!user) {
      return res.status(404).json({
        status: "Error",
        message: "User not found!",
      });
    }

    // Validate custom
    if (type === "custom" && (!startDate || !endDate)) {
      return res.status(400).json({
        status: "Error",
        message: "StartDate and endDate are required!",
      });
    }

    // Build date filter
    const dateFilter = buildDateFilter({
      type,
      year,
      month,
      trimester,
      startDate,
      endDate,
    });

    // Fetch records
    const records = await Attendance.find({
      userId: user._id,
      date: dateFilter,
    }).sort({ date: 1 }); // Sort by date ascending for better readability in exports

    if (records.length === 0) {
      return res.status(404).json({
        status: "Error",
        message: "No attendance records found for the specified period!",
      });
    }

    // Format data
    const formatted = records.map((r) => ({
      Date: r.date.toISOString().split("T")[0],
      CheckIn: r.checkInTime || "-",
      CheckOut: r.checkOutTime || "-",
      Status: r.status || "absent",
    }));

    // Build the filename (The user name included)
    const fullName = `${user.name}_${user.lastName || ""}`;
    const cleanName = sanitize(fullName);
    const periodLabel = getPeriodLabel({
      type,
      year,
      month,
      trimester,
      startDate,
      endDate,
    });

    const extension = format === "csv" ? "csv" : "xlsx";
    const fileName =
      `attendance_${cleanName}_${periodLabel}.${extension}`.toLowerCase();

    // Export based on the requested format (CSV or Excel)
    if (format === "csv") {
      return exportCSV(formatted, res, fileName);
    }

    if (format === "excel") {
      return exportExcel(formatted, res, fileName);
    }

    // If the format requested is Invalid
    return res.status(400).json({
      status: "Error",
      message: "Invalid export format!",
    });
  } catch (err) {
    next(err);
  }
};

// Export the attendance records of the department users to CSV/Excel (Admin Only)
export const exportDepartmentAttendance = async (req, res, next) => {
  try {
    const {
      departmentName,
      type,
      year,
      month,
      trimester,
      startDate,
      endDate,
      format,
    } = req.query;

    // Activate the includeName flag to include the user names in the export file
    const includeName = true;

    // Get department and check its existance by name (Because the department names are unique)
    const department = await Department.findOne({ name: departmentName });
    if (!department) {
      return res.status(404).json({
        status: "Error",
        message: "Department not found!",
      });
    }

    // Get all the users in that department
    const users = await User.find({ department_id: department._id });
    if (!users.length) {
      return res.status(404).json({
        status: "Error",
        message: "No users found in this department!",
      });
    }

    // Extract user IDs for attendance query
    const userIds = users.map((u) => u._id);

    // Build the date filter
    const dateFilter = buildDateFilter({
      type,
      year: Number(year),
      month: Number(month),
      trimester: Number(trimester),
      startDate,
      endDate,
    });

    // Get attendance records
    const records = await Attendance.find({
      userId: { $in: userIds },
      date: dateFilter,
    }).populate("userId", "name lastName");

    if (!records.length) {
      return res.status(404).json({
        status: "Error",
        message: "No attendance records found for this department!",
      });
    }

    // Format the return data for export
    const formattedData = records.map((r) => ({
      Name: `${r.userId.name} ${r.userId.lastName}`,
      Date: r.date.toISOString().split("T")[0], // Format date as YYYY-MM-DD
      CheckIn: r.checkInTime || "-",
      CheckOut: r.checkOutTime || "-",
      Status: r.status,
      Location: r.location || "-",
    }));

    // Sanitize the department name for the filename
    const cleanDeptName = sanitize(department.name);

    // Build the filename (The user name included)
    const periodLabel = getPeriodLabel({
      type,
      year,
      month,
      trimester,
      startDate,
      endDate,
    });

    const extension = format === "csv" ? "csv" : "xlsx";

    // Generate file name
    const fileName =
      `attendance_${cleanDeptName}_department_${periodLabel}.${extension}`.toLowerCase();

    // Export logic
    if (format === "csv") {
      return exportCSV(formattedData, res, fileName);
    }

    if (format === "excel") {
      return exportExcel(formattedData, res, fileName, includeName);
    }

    res.status(400).json({
      status: "Error",
      message: "Invalid export Format!",
    });
  } catch (error) {
    next(error);
  }
};

// Export attendance stats (KPIs) for users to CSV/Excel (Admin Only)
export const exportAttendanceStatistics = async (req, res, next) => {
  try {
    const {
      userName,
      userLastName,
      userEmail,
      departmentName,
      periodType,
      startDate,
      endDate,
      kpis,
      format,
    } = req.query;

    let userId = null;
    let departmentId = null;

    // Validate user existance and get the user ID (If the stats export is for a specific user)
    if (userName) {
      const user = await User.findOne({
        name: userName,
        lastName: userLastName,
        email: userEmail,
      });
      if (!user) {
        return res.status(404).json({
          status: "Error",
          message: "User not found!",
        });
      }

      userId = user._id;
    }

    // Validate department existance
    if (departmentName) {
      const department = await Department.findOne({ name: departmentName });
      if (!department) {
        return res.status(404).json({
          status: "Error",
          message: "Department not found!",
        });
      }
      departmentId = department._id;
    }

    // Get the selected KPIs from the query
    const selectedKPIs = kpis ? kpis.split(",") : undefined;

    await exportAttendanceStats({
      userId,
      departmentId,
      periodType,
      startDate,
      endDate,
      selectedKPIs,
      format,
      res,
    });
  } catch (error) {
    next(error);
  }
};
