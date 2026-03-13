import Timetable from "../models/Timetable.js";
import AppError from "../utils/AppError.js";

// Get timetable for a specific user
export const getTimetableByUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { start, end } = req.query;

    let query = { userId };

    if (start && end) {
      query.date = {
        $gte: new Date(start),
        $lte: new Date(end),
      };
    }

    const shifts = await Timetable.find(query).sort({ date: 1 });

    res.status(200).json({
      status: "Success",
      result: shifts,
    });
  } catch (err) {
    next(err);
  }
};

// Update or create a timetable entry
export const updateTimetableEntry = async (req, res, next) => {
  try {
    const { userId, date, type, location, color, duration } = req.body;

    if (!userId || !date || !type || !location) {
      throw new AppError("Missing required fields (userId, date, type, location)", 400);
    }

    // Use findOneAndUpdate with upsert to handle both create and update
    // Normalize date to midnight to ensure consistent indexing
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const shift = await Timetable.findOneAndUpdate(
      { userId, date: normalizedDate },
      { 
        type, 
        location, 
        color, 
        duration 
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      status: "Success",
      message: "Timetable entry updated successfully",
      result: shift,
    });
  } catch (err) {
    next(err);
  }
};

// Delete a timetable entry
export const deleteTimetableEntry = async (req, res, next) => {
  try {
    const { userId, date } = req.body;

    if (!userId || !date) {
      throw new AppError("Missing required fields (userId, date)", 400);
    }

    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    await Timetable.findOneAndDelete({ userId, date: normalizedDate });

    res.status(200).json({
      status: "Success",
      message: "Timetable entry deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};
// Bulk update or create timetable entries
export const bulkUpdateTimetableEntries = async (req, res, next) => {
  try {
    const { userId, dates, type, location, color, duration } = req.body;

    if (!userId || !dates || !Array.isArray(dates) || dates.length === 0 || !type || !location) {
      throw new AppError("Missing required fields (userId, dates array, type, location)", 400);
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
          duration 
        },
        { new: true, upsert: true, runValidators: true }
      );
      updatedShifts.push(shift);
    }

    res.status(200).json({
      status: "Success",
      message: `${updatedShifts.length} timetable entries updated successfully`,
      results: updatedShifts,
    });
  } catch (err) {
    next(err);
  }
};
