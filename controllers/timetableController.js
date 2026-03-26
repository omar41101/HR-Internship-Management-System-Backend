import User from "../models/User.js";
import Timetable from "../models/Timetable.js";
import AppError from "../utils/AppError.js";
import { io } from "../server.js";

// -------------------------------------------------------------------- //
// --------------------- TIMETABLE SHIFT RULES ------------------------ //
// -------------------------------------------------------------------- //
const SHIFT_CONFIG = {
  "Morning Shift": {
    startTime: "09:00",
    endTime: "13:00",
  },
  "Evening Shift": {
    startTime: "14:30",
    endTime: "17:00",
  },
};

// Get timetable (shifts) for a specific user
export const getTimetableByUser = async (req, res, next) => {
  try {
    const { userId } = req.params; // Get userId from URL parameters
    const { start, end } = req.query; // Optional query parameters for date range filtering

    // Check the user existance
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    let query = { userId };

    // If the client provided start and end dates, filter the timetable entries accordingly
    if (start && end) {
      const startDate = new Date(start);
      startDate.setUTCHours(0, 0, 0, 0);

      const endDate = new Date(end);
      endDate.setUTCHours(23, 59, 59, 999);

      query.date = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    const shifts = await Timetable.find(query).sort({ date: 1 }); // date: 1: oldest to latest shifts

    res.status(200).json({
      status: "Success",
      message: "Timetable fetched successfully!",
      result: shifts,
    });
  } catch (err) {
    next(err);
  }
};

// Add a new timetable entry (shift) for a user on a specific date (Admin only)
export const addTimetableEntry = async (req, res, next) => {
  try{

  }
  catch(err){
    next(err);
  }
};

// Update timetable entry (shift) for a user on a specific date
export const updateTimetableEntry = async (req, res, next) => {
  try {
    const {
      userId,
      date,
      type,
      location,
      color,
      duration,
      startTime,
      endTime,
    } = req.body;

    if (!userId || !date || !type || !location) {
      throw new AppError(
        "Missing required fields (userId, date, type, location)",
        400,
      );
    }

    // Check user existence
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Normalize date to UTC midnight
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    // Handle the "Day Off" case
    if (type === "Day Off") {
      await Timetable.deleteMany({ userId, date: normalizedDate, type });

      const shift = await Timetable.create({
        userId,
        date: normalizedDate,
        type: "Day Off",
        location,
        color,
        duration,
      });

      return res.status(200).json({
        status: "Success",
        message: "Day off created successfully!",
        result: shift,
      });
    }

    // Handle the Day Off case
    await Timetable.deleteMany({
      userId,
      date: normalizedDate,
      type: "Day Off",
    });

    // Handle the Full-time shift case
    if (type === "Full-time Shift") {
      const morningConfig = SHIFT_CONFIG["Morning Shift"];
      const eveningConfig = SHIFT_CONFIG["Evening Shift"];

      // Check if Morning Shift exists, if not, create it
      const morningShift = await Timetable.findOneAndUpdate(
        { userId, date: normalizedDate, type: "Morning Shift" },
        {
          userId,
          date: normalizedDate,
          type: "Morning Shift",
          location,
          color,
          duration,
          ...morningConfig,
        },
        { upsert: true, returnDocument: "after", runValidators: true },
      );

      // Check if Evening Shift exists, if not, create it
      const eveningShift = await Timetable.findOneAndUpdate(
        { userId, date: normalizedDate, type: "Evening Shift" },
        {
          userId,
          date: normalizedDate,
          type: "Evening Shift",
          location,
          color,
          duration,
          ...eveningConfig,
        },
        { upsert: true, returnDocument: "after", runValidators: true },
      );

      return res.status(200).json({
        status: "Success",
        message: "Full-time shifts ensured successfully!",
        result: { morningShift, eveningShift },
      });
    }

    // Handle single shift case (Morning, Evening, Special Shift)
    let shiftData = {
      userId,
      date: normalizedDate,
      type,
      location,
      color,
      duration,
    };

    if (type !== "Special Shift") {
      const config = SHIFT_CONFIG[type];

      if (!config) {
        throw new AppError("Invalid shift type", 400);
      }

      shiftData = {
        ...shiftData,
        ...config,
      };
    } else {
      // Special Shift requires custom times
      if (!startTime || !endTime) {
        throw new AppError(
          "Special Shift requires both startTime and endTime!",
          400,
        );
      }

      shiftData = {
        ...shiftData,
        startTime,
        endTime,
      };
    }

    const shift = await Timetable.findOneAndUpdate(
      { userId, date: normalizedDate, type },
      shiftData,
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
      },
    );

    /**
     * WHAT: Real-time update broadcast
     * WHY: Emitting this event allows the frontend to refresh the timetable 
     *      instantly if the logged-in user's schedule is being edited by an admin.
     *      Crucial for "Sync Admin Edits with User Personal Timetable" feature.
     */
    io.emit("timetableUpdated", { userId });

    res.status(200).json({
      status: "Success",
      message: "Timetable entry updated successfully!",
      result: shift,
    });
  } catch (err) {
    next(err);
  }
};

// Add multiple timetable entries (shifts)
export const addMultipleTimetableEntries = async (req, res, next) => {
  try {
    
  }
  catch(err){
    next(err);
  }
};

// Bulk update or create multiple timetable entries (shifts) for a user across multiple dates
export const bulkUpdateTimetableEntries = async (req, res, next) => {
  try {
    const {
      userId,
      dates,
      type,
      location,
      color,
      duration,
      startTime,
      endTime,
    } = req.body;

    if (
      !userId ||
      !dates ||
      !Array.isArray(dates) ||
      dates.length === 0 ||
      !type ||
      !location
    ) {
      throw new AppError(
        "Missing required fields (userId, dates array, type, location)",
        400,
      );
    }

    // Check the user existence
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const updatedShifts = [];

    for (const date of dates) {
      const normalizedDate = new Date(date);
      normalizedDate.setUTCHours(0, 0, 0, 0);

      // Handle the full-time shift case (Creation of 2 shifts: Morning and Evening)
      if (type === "Full-time Shift") {
        const morningConfig = SHIFT_CONFIG["Morning Shift"];
        const eveningConfig = SHIFT_CONFIG["Evening Shift"];

        // Delete old shifts if they exist
        await Timetable.deleteMany({ userId, date: normalizedDate });

        // Create Morning + Evening
        const shifts = await Timetable.insertMany([
          {
            userId,
            date: normalizedDate,
            type: "Morning Shift",
            location,
            color,
            duration,
            ...morningConfig,
          },
          {
            userId,
            date: normalizedDate,
            type: "Evening Shift",
            location,
            color,
            duration,
            ...eveningConfig,
          },
        ]);

        updatedShifts.push(...shifts);
        continue; // Skip to next date
      }

      // Handle single shifts (Morning, Evening, Special)
      let shiftData = {
        userId,
        date: normalizedDate,
        type,
        location,
        color,
        duration,
      };

      if (type !== "Special Shift") {
        const config = SHIFT_CONFIG[type];
        if (!config) throw new AppError("Invalid shift type", 400);
        shiftData = { ...shiftData, ...config };
      } else {
        // Special Shift requires startTime and endTime
        if (!startTime || !endTime) {
          throw new AppError(
            "Special Shift requires both startTime and endTime!",
            400,
          );
        }
        shiftData = { ...shiftData, startTime, endTime };
      }

      const shift = await Timetable.findOneAndUpdate(
        { userId, date: normalizedDate, type },
        shiftData,
        { new: true, upsert: true, runValidators: true },
      );

      updatedShifts.push(shift);
    }

    // Notify user of schedule change
    io.emit("timetableUpdated", { userId });

    res.status(200).json({
      status: "Success",
      message: `${updatedShifts.length} timetable entries updated successfully!`,
      results: updatedShifts,
    });
  } catch (err) {
    next(err);
  }
};

// Delete a timetable entry (a user shift) for a specific date
export const deleteTimetableEntry = async (req, res, next) => {
  try {
    const { userId, date, type } = req.body;

    if (!userId || !date || !type) {
      throw new AppError("Missing required fields (userId, date, type)", 400);
    }

    // Check the user existance
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    // Check the timetable entry existance
    const existingEntry = await Timetable.findOne({
      userId,
      date: normalizedDate,
      type,
    });
    if (!existingEntry) {
      throw new AppError(
        "Timetable entry not found for the specified date and type",
        404,
      );
    }

    await Timetable.findOneAndDelete({ userId, date: normalizedDate, type });

    // Notify user of schedule change
    io.emit("timetableUpdated", { userId });

    res.status(200).json({
      status: "Success",
      message: "Timetable entry deleted successfully!",
    });
  } catch (err) {
    next(err);
  }
};

// Clear all shift records for a specific month (Admin/HR Only)
export const clearMonthTimetable = async (req, res, next) => {
  try {
    const { userId, year: yearParam, month: monthParam } = req.params;

    if (!userId || yearParam === undefined || monthParam === undefined) {
      throw new AppError("Missing required parameters (userId, year, month)", 400);
    }

    const year = parseInt(yearParam);
    const month = parseInt(monthParam);

    if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
      throw new AppError("Invalid year or month format", 400);
    }

    // Check the user existence
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Compute first and last day of the month
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // Delete all timetable entries for the user within the specified month
    const result = await Timetable.deleteMany({
      userId,
      date: { $gte: startDate, $lte: endDate },
    });

    // Notify user of schedule change
    io.emit("timetableUpdated", { userId });

    res.status(200).json({
      status: "Success",
      message: `${startDate.toLocaleString("default", { month: "long" })} timetable cleared successfully!`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    next(err);
  }
};
