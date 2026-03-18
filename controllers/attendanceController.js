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
