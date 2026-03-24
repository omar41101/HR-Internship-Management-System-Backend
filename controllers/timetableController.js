import User from "../models/User.js";
import Timetable from "../models/Timetable.js";
import AppError from "../utils/AppError.js";

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
      query.date = {
        $gte: new Date(start),
        $lte: new Date(end),
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

// Update or create a timetable entry (shift) for a user on a specific date
export const updateTimetableEntry = async (req, res, next) => {
  try {
    const { userId, date, type, location, color, duration } = req.body;

    if (!userId || !date || !type || !location) {
      throw new AppError(
        "Missing required fields (userId, date, type, location)",
        400,
      );
    }

    // Check the user existance
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Normalize date to midnight to ensure consistent indexing
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const shift = await Timetable.findOneAndUpdate(
      { userId, date: normalizedDate },
      {
        type,
        location,
        color,
        duration,
      },
      // upsert: true = Creates a new document if no document matches the filter
      // runValidators: true = Ensures that the update operation respects the schema validation rules
      { new: true, upsert: true, runValidators: true },
    );

    res.status(200).json({
      status: "Success",
      message: "Timetable entry updated successfully!",
      result: shift,
    });
  } catch (err) {
    next(err);
  }
};

// Bulk update or create multiple timetable entries
export const bulkUpdateTimetableEntries = async (req, res, next) => {
  try {
    const { userId, dates, type, location, color, duration } = req.body;

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

    // Check the user existance
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const updatedShifts = [];

    for (const date of dates) {
      const normalizedDate = new Date(date);
      normalizedDate.setUTCHours(0, 0, 0, 0);

      const shift = await Timetable.findOneAndUpdate(
        { userId, date: normalizedDate },
        {
          type,
          location,
          color,
          duration,
        },
        { new: true, upsert: true, runValidators: true },
      );
      updatedShifts.push(shift);
    }

    res.status(200).json({
      status: "Success",
      message: `${updatedShifts.length} timetable entries updated successfully!`,
      results: updatedShifts,
    });
  } catch (err) {
    next(err);
  }
};

// Delete a timetable entry (user shift) for a specific date
export const deleteTimetableEntry = async (req, res, next) => {
  try {
    const { userId, date } = req.body;

    if (!userId || !date) {
      throw new AppError("Missing required fields (userId, date)", 400);
    }

    // Check the user existance
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    // Check the timetable entry existance
    const existingEntry = await Timetable.findOne({ userId, date: normalizedDate });
    if (!existingEntry) {
      throw new AppError("Timetable entry not found for the specified date", 404);
    }

    await Timetable.findOneAndDelete({ userId, date: normalizedDate });

    res.status(200).json({
      status: "Success",
      message: "Timetable entry deleted successfully!",
    });
  } catch (err) {
    next(err);
  }
};
