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
  "Full-time Shift": {
    startTime: "09:00",
    endTime: "17:00",
  }
};

// Checks the HH:mm format for startTime and endTime fields in Special Shifts
const isValidTime = (time) => {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
};

// Checks the validity of location
const isValidLocation = (location) => {
  return ["Remote", "Onsite"].includes(location);
};

// -------------------------------------------------------------------- //
// --------------------- TIMETABLE MANAGEMENT ------------------------- //
// -------------------------------------------------------------------- //

// Add a new timetable entry (shift) for a user on a specific date: Only used for empty days (Admin only)
export const addTimetableEntry = async (req, res, next) => {
  try {
    const {
      userId,
      date,
      type,
      location,
      color,
      startTime,
      endTime,
    } = req.body;

    if (!userId || !date || !type) {
      throw new AppError(
        "Missing required fields (userId, date, type)",
        400
      );
    }

    // Check the user existence
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found!", 404);

    // Normalize the date to UTC to ensure consistency
    const normalizedDate = new Date(date);
    if (isNaN(normalizedDate.getTime())) throw new AppError("Invalid date", 400);
    const dateStr = normalizedDate.toISOString().split("T")[0]; // E.g., "2026-04-04"

    // Check a timetable entry existence for the same user and date
    const existingEntry = await Timetable.findOne({
      userId,
      date: dateStr,
    });
    if (existingEntry) {
      throw new AppError("Timetable already exists for this date!", 400);
    }

    // Prepare the common shift data
    let shiftData = { userId, type, date: dateStr, color };

    // Handle the "Day Off" Adding case
    if (type === "Day Off") {
      const shift = await Timetable.create(shiftData);
      console.log("[ADD-TIMETABLE-ENTRY] Day Off created!");

      io.emit("timetableUpdated", { userId });

      return res.status(201).json({
        status: "Success",
        message: "Day off created successfully!",
        result: shift,
      });
    }

    // Check the location constraint for working shifts (Morning, Evening, Special, Full-time)
    if (!location) throw new AppError("Location is required for working shifts!", 400);
    if (!isValidLocation(location)) {
      throw new AppError("Invalid location! Must be 'Remote' or 'Onsite'", 400);
    }
    shiftData.location = location;

    // Handle the working shifts cases (Morning, Evening, Special, Full-time)
    if (type === "Special Shift") {
      if (!startTime || !endTime) {
        throw new AppError("Special Shift requires startTime and endTime!", 400);
      }
      if (!isValidTime(startTime) || !isValidTime(endTime)) {
        throw new AppError("Time must be HH:mm format!", 400);
      }
      shiftData.startTime = startTime;
      shiftData.endTime = endTime;
    } 
    // Handle the Morning, Evening and Full-time shift cases
    else {
      const config = SHIFT_CONFIG[type];
      if (!config) throw new AppError("Invalid shift type!", 400);
      shiftData = { ...shiftData, ...config };
    }

    const shift = await Timetable.create(shiftData);
    console.log(`[ADD-TIMETABLE-ENTRY] ${type} created!`);

    io.emit("timetableUpdated", { userId });

    res.status(201).json({
      status: "Success",
      message: "Timetable entry created successfully!",
      result: shift,
    });
  } catch (err) {
    next(err);
  }
};

// Update timetable entry (shift) for a user on a specific date: For already existing shifts (Admin only)
export const updateTimetableEntry = async (req, res, next) => {
  try {
    const {
      timetableId,
      color,
      type,
      location,
      startTime,
      endTime,
    } = req.body;

    if (!timetableId || !type) {
      throw new AppError("Missing required fields!", 400);
    }

    // Check timetable entry existence
    const existingEntry = await Timetable.findById(timetableId);
    if (!existingEntry) {
      throw new AppError("Timetable entry not found!", 404);
    }

    // Extract userId and date 
    const { userId, date } = existingEntry;

    // CASE 1: UPDATE THE SAME TYPE → JUST UPDATE (NO DELETION)
    if (existingEntry.type === type) {
      // Morning, Evening and Full-time cases (Options of update: location and color) + Special Shift case
      if (type !== "Day Off") {
        if (location && !isValidLocation(location)) {
          throw new AppError("Invalid location! Must be 'Remote' or 'Onsite'", 400);
        }

        existingEntry.location = location || existingEntry.location; 
        existingEntry.color = color || existingEntry.color;
      }

      // Special Shift (Plus Options of update: startDate + endDate)
      if (type === "Special Shift") {
        if (startTime) {
          if (!isValidTime(startTime))
            throw new AppError("Start Time must be in HH:mm format!", 400);
          existingEntry.startTime = startTime;
        }
        if (endTime) {
          if (!isValidTime(endTime))
            throw new AppError("End Time must be in HH:mm format!", 400);
          existingEntry.endTime = endTime;
        }
      }

      // Save the changes
      await existingEntry.save();

      console.log(`[UPDATE-TIMETABLE] Same ${existingEntry.type} updated!`);

      io.emit("timetableUpdated", { userId });

      return res.status(200).json({
        status: "Success",
        message: `${existingEntry.type} updated successfully!`,
        result: existingEntry,
      });
    } 

    // CASE 2: SHIFT TYPE CHANGE

    // Deletion of the old shift
    await Timetable.deleteOne({ _id: timetableId });

    // Prepare for the creation of the new shift
    let newShiftData = {
      userId,
      date,
      type,
      color
    };

    // Add location if not Day Off
    if (type !== "Day Off") {
      if (!location) throw new AppError("Location is required!", 400);
      if (!isValidLocation(location)) {
        throw new AppError("Invalid location! Must be 'Remote' or 'Onsite'", 400);
      }
      newShiftData.location = location;
    }

    // Handle Special Shift
    if (type === "Special Shift") {
      if (!startTime || !endTime)
        throw new AppError("Special Shift requires startTime and endTime!", 400);
      if (!isValidTime(startTime) || !isValidTime(endTime))
        throw new AppError("Time must be in HH:mm format!", 400);

      newShiftData.startTime = startTime;
      newShiftData.endTime = endTime;
    }
    else if (type !== "Day Off") {
      const config = SHIFT_CONFIG[type];
      if (!config) throw new AppError("Invalid shift type!", 400);

      newShiftData = { ...newShiftData, ...config };
    }

    console.log(`[UPDATE-TIMETABLE] ${type} created successfully (Change of shift type)!`);
    const newShift = await Timetable.create(newShiftData);

    io.emit("timetableUpdated", { userId });

    return res.status(200).json({
      status: "Success",
      message: `Shift updated successfully to ${type}!`,
      result: newShift,
    });
  } catch (err) {
    next(err);
  }
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

    // Check if the id (if supervisor) is the user's supervisor id
    if (user.supervisorId.toString() !== req.user._id.toString()) {
      throw new AppError("Unauthorized!", 403);
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

// Bulk update or create multiple timetable entries (shifts) for a user across multiple dates: STILL NOT DONE
export const bulkUpdateTimetableEntries = async (req, res, next) => {
  try {
    const {
      userId,
      dates,
      type,
      location,
      color,
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
      // Normalize the date to UTC to ensure consistency
      const normalizedDate = new Date(date);
      if (isNaN(normalizedDate.getTime())) throw new AppError("Invalid date", 400);
      const dateStr = normalizedDate.toISOString().split("T")[0]; // E.g., "2026-04-04"

      // Prepare the common shift data
      let shiftData = {
        userId,
        date: dateStr,
        type,
        color,
      };

      // Handle the "Day Off" case
      if (type === "Day Off") {
        const shift = await Timetable.findOneAndUpdate(
          { userId, date: dateStr },
          shiftData,
          { returnDocument: "after", upsert: true, runValidators: true },
        );

        updatedShifts.push(shift);
        continue; // Move to the next date
      }
      else { // For working shifts (Morning, Evening, Full-time and Special Shift)

        // Check the location constraint for working shifts (Morning, Evening, Special, Full-time)
        if (!location){
          throw new AppError("Location is required for working shifts!", 400);
        }
        if (!isValidLocation(location)) {
          throw new AppError("Invalid location! Must be 'Remote' or 'Onsite'", 400);
        }

        // Morning, Evening, Full-time and Special Shift cases
        if (type !== "Special Shift") {
          const config = SHIFT_CONFIG[type];
          if (!config) throw new AppError("Invalid shift type", 400);
          shiftData = { ...shiftData, ...config };
          shiftData.location = location;
        } 
        else {
          // Special Shift requires startTime and endTime
          if (!startTime || !endTime) {
            throw new AppError(
              "Special Shift requires both startTime and endTime!",
              400,
            );
          }
          if (!isValidTime(startTime) || !isValidTime(endTime)) {
            throw new AppError("startTime and endTime must be in HH:mm format!", 400);
          }

          shiftData = { ...shiftData, startTime, endTime };
          shiftData.location = location;
        }

        const shift = await Timetable.findOneAndUpdate(
          { userId, date: dateStr, type },
          shiftData,
          { returnDocument: "after", upsert: true, runValidators: true },
        );

        updatedShifts.push(shift);
      }
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
