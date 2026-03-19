import User from "../models/User.js";
import Attendance from "../models/Attendance.js";
import Timetable from "../models/Timetable.js";
import { io } from "../server.js";

import { buildDateFilter } from "../utils/dateFilter.js";
import { exportCSV, exportExcel, sanitize, getPeriodLabel } from "../utils/exportHelpers.js";

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
    const { location } = req.body; // Get the user location (Remote/Onsite)
    const now = new Date(); // The exact current date and time when the user clicked on the button Check in.
    const today = getStartOfDay(now); // Today's date

    // Get the user's existance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "Error",
        message: "User not found!",
      });
    }
    
    // Get the user's shift for today to determine if they are late
    const shift = await Timetable.findOne({ userId, date: today });

    let status = "present";
    if (shift) {
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      if (currentHour > 9 || (currentHour === 9 && currentMinute > 15)) {
        status = "late";
      }
    }

    const checkInTime = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Create or update attendance record
    const attendance = await Attendance.findOneAndUpdate(
      { userId, date: today },
      {
        checkInTime,
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
    if(!attendance) {
      return res.status(200).json({
        status: "success",
        message: "No attendance record found for today. You haven't checked in yet!",
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
    const { userId, startDate, endDate } = req.query;
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
      if (endDate) filter.date.$lte = getStartOfDay(endDate);
    }

    const attendanceRecords = await Attendance.find(filter)
      .populate("userId", "name lastName department_id email")
      .sort({ date: -1 });

    res.status(200).json({
      status: "success",
      results: attendanceRecords.length,
      result: attendanceRecords,
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
    const today = getStartOfDay(now);

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
      { userId, date: today },
      { checkOutTime },
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

// Export the attendance records of a precise user to CSV (Admin Only)
export const exportUserAttendance = async (req, res, next) => {
  try {
    const {
      userId,
      type,
      year,
      month,
      trimester,
      format,
      startDate,
      endDate,
    } = req.query;

    // Validate custom
    if (type === "custom" && (!startDate || !endDate)) {
      return res.status(400).json({
        status: "Error",
        message: "StartDate and endDate are required!",
      });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "Error",
        message: "User not found!",
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
      userId,
      date: dateFilter,
    }).sort({ date: 1 }); // Sort by date ascending for better readability in exports

    if(records.length === 0) {
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
      Status: r.status || "Absent",
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
    const fileName = `attendance_${cleanName}_${periodLabel}.${extension}`.toLowerCase();

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
