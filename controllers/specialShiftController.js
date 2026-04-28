import SpecialShift from "../models/SpecialShift.js";
import AppError from "../utils/AppError.js";

// Get all reusable Special Shift types
export const getSpecialShifts = async (req, res, next) => {
  try {
    const shifts = await SpecialShift.find()
      .sort({ createdAt: -1 })
      .populate("createdBy", "name lastName");

    res.status(200).json({
      status: "Success",
      code: 200,
      message: `${shifts.length} Special Shift types retrieved successfully!`,
      data: shifts,
    });
  } catch (err) {
    next(err);
  }
};

// Create a new reusable Special Shift type
export const createSpecialShift = async (req, res, next) => {
  try {
    const { name, description, type, periods } = req.body;

    // ─── Early Validation ────────────────────────────────────────────────────
    if (!name || !name.trim()) {
      throw new AppError("Shift name is required", 400);
    }

    if (!type || !["single", "double"].includes(type)) {
      throw new AppError("Type must be 'single' or 'double'", 400);
    }

    if (!Array.isArray(periods) || periods.length === 0) {
      throw new AppError("Periods array is required", 400);
    }

    // Enforce type ↔ period count consistency
    if (type === "single" && periods.length !== 1) {
      throw new AppError(
        "A 'single' shift type must have exactly 1 period",
        400
      );
    }
    if (type === "double" && periods.length !== 2) {
      throw new AppError(
        "A 'double' shift type must have exactly 2 periods",
        400
      );
    }

    // Validate each period's time format (HH:MM)
    const timeRegex = /^\d{2}:\d{2}$/;
    for (let i = 0; i < periods.length; i++) {
      const { startTime, endTime } = periods[i] || {};
      if (!startTime || !timeRegex.test(startTime)) {
        throw new AppError(
          `Period ${i + 1}: startTime must be in HH:MM format`,
          400
        );
      }
      if (!endTime || !timeRegex.test(endTime)) {
        throw new AppError(
          `Period ${i + 1}: endTime must be in HH:MM format`,
          400
        );
      }
    }
    // ─── End Validation ───────────────────────────────────────────────────────

    const specialShift = await SpecialShift.create({
      name: name.trim(),
      description: description?.trim() || "",
      type,
      periods,
      createdBy: req.user.id,
    });

    res.status(201).json({
      status: "Success",
      code: 201,
      message: "Special Shift type created successfully",
      data: specialShift,
    });
  } catch (err) {
    next(err);
  }
};