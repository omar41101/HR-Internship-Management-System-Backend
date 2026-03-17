import Attendance from "../models/Attendance.js";
import Timetable from "../models/Timetable.js";
import User from "../models/User.js";
import { io } from "../server.js";

// Helper to get start of day in UTC
const getStartOfDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// @desc    Check-in
// @route   POST /api/attendance/check-in
// @access  Private
export const checkIn = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { location } = req.body;
    const now = new Date();
    const today = getStartOfDay(now);

    // 1. Get user's shift for today to determine if they are late
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

    // 2. Create or update attendance record
    const attendance = await Attendance.findOneAndUpdate(
      { userId, date: today },
      {
        checkInTime,
        status,
        location,
        checkOutTime: null,
      },
      { upsert: true, new: true }
    );

    // 3. Emit real-time event to all connected clients
    io.emit("attendanceUpdated", {
      action: "checkIn",
      userId: String(userId),
      attendance,
    });

    res.status(200).json({
      status: "success",
      result: attendance,
      message: "Checked in successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check-out
// @route   POST /api/attendance/check-out
// @access  Private
export const checkOut = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const today = getStartOfDay(now);
    const checkOutTime = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const attendance = await Attendance.findOneAndUpdate(
      { userId, date: today },
      { checkOutTime },
      { new: true }
    );

    if (!attendance) {
      return res.status(404).json({
        status: "fail",
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
      message: "Checked out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get attendance records
// @route   GET /api/attendance
// @access  Private (Admin/Supervisor, or self)
export const getAttendance = async (req, res, next) => {
  try {
    const { userId, department, startDate, endDate } = req.query;
    const filter = {};

    // 1. Authorization & Identity
    if (
      req.user.role.name === "Admin" ||
      req.user.role.name === "Supervisor"
    ) {
      if (userId) filter.userId = userId;
    } else {
      filter.userId = req.user._id;
    }

    // 2. Date Filtering
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

// @desc    Admin updates attendance record directly
// @route   PATCH /api/attendance/:id
// @access  Private (Admin/Supervisor)
export const updateAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const attendance = await Attendance.findByIdAndUpdate(id, updates, {
      new: true,
    });

    if (!attendance) {
      return res
        .status(404)
        .json({ status: "fail", message: "Attendance record not found" });
    }

    // Emit real-time event for admin updates too
    io.emit("attendanceUpdated", {
      action: "adminUpdate",
      attendance,
    });

    res.status(200).json({
      status: "success",
      result: attendance,
      message: "Attendance updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current status for logged-in user
// @route   GET /api/attendance/me
// @access  Private
export const getMyStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const today = getStartOfDay(new Date());

    const attendance = await Attendance.findOne({ userId, date: today });

    res.status(200).json({
      status: "success",
      result: attendance,
    });
  } catch (error) {
    next(error);
  }
};