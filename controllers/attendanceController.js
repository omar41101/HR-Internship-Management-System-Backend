import User from "../models/User.js";
import Department from "../models/Department.js";
import Attendance from "../models/Attendance.js";
import Timetable from "../models/Timetable.js";
import { io } from "../server.js";

import { buildDateFilter } from "../utils/dateFilter.js";
import {
  exportCSV,
  exportExcel,
  sanitize,
  getPeriodLabel,
} from "../utils/exportHelpers.js";
import { exportAttendanceStats } from "../services/attendanceExportService.js";

// Helper to get start of day in UTC
const getStartOfDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// Check-in function
export const checkIn = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get the user location (Remote/Onsite)
    const { location } = req.body;

    const now = new Date(); // Contains UTC internally but displays in local time when logged

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

    // Get the user's shift for today to determine if they are late
    const shift = await Timetable.findOne({
      userId,
      date: {
        $gte: todayUTC,
        $lt: new Date(todayUTC.getTime() + 86400000),
      },
    });

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
        location,
        checkOutTime: null,
      },
      { upsert: true, new: true },
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
    const { userId, 
      startDate, 
      endDate, 
      status, 
      role, 
      department, 
      search,
      page = 1, 
    } = req.query;

    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const limit = 10;

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

    // Authorization & Identity
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

    // Get attendance records
    let attendanceRecords = await Attendance.find(filter)
      .populate({
        path: "userId",
        populate: [{ path: "role_id" }, { path: "department_id" }],
      })
      .sort({ date: -1 })
      .lean();

    // Search user by name/lastName or email
    if (search) {
      const q = search.toLowerCase();

      attendanceRecords = attendanceRecords.filter((a) => {
        const user = a.userId;
        return (
          user?.name?.toLowerCase().includes(q) ||
          user?.lastName?.toLowerCase().includes(q) ||
          user?.email?.toLowerCase().includes(q)
        );
      });
    }

    // Filter By Role
    if (role) {
      attendanceRecords = attendanceRecords.filter(
        (a) => a.userId?.role_id?.name?.toLowerCase() === role.toLowerCase(),
      );
    }

    // Filter By Department
    if (department) {
      attendanceRecords = attendanceRecords.filter(
        (a) =>
          a.userId?.department_id?.name?.toLowerCase() ===
          department.toLowerCase(),
      );
    }

    // Total records after filtering for the frontend
    const totalRecords = attendanceRecords.length;

    // Get the paginated records
    const paginatedRecords = attendanceRecords.slice(
      (parsedPage - 1) * limit,
      parsedPage * limit
    );

    res.status(200).json({
      status: "success",
      page: parsedPage,
      limit: limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      results: paginatedRecords.length,
      result: paginatedRecords,
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
