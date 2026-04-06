import LeaveType from "../models/LeaveType.js";
import AppError from "../utils/AppError.js";
import { logAuditAction } from "../utils/logger.js"; // For audit logs

// ---------------------------------------------------------------- //
// ----------------------- HELPER FUNCTIONS ----------------------- //
// ---------------------------------------------------------------- //
export const validateLeaveTypeName = (name) => {
  if (!name || name.trim() === "") {
    throw new AppError("Leave type name is required!", 400);
  }

  // Normalize the leave type name
  return (
    name.trim().charAt(0).toUpperCase() + name.trim().slice(1).toLowerCase()
  );
};

// Check the name existance
export const checkLeaveTypeNameExistence = async (name, id) => {
  const existingLeaveType = await LeaveType.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
    _id: { $ne: id },
  });

  if (existingLeaveType) {
    throw new AppError("Leave type already exists!", 409);
  }
};

// ---------------------------------------------------------------- //
// ---------------------- LEAVE TYPE MANAGEMENT ------------------- //
// ---------------------------------------------------------------- //

// Add a new Leave Type (Admin only)
export const addLeaveType = async (req, res, next) => {
  try {
    let { name } = req.body;
    const { description, isPaid } = req.body;

    // Validate the leave type name
    name = validateLeaveTypeName(name);

    // Check the name existance
    await checkLeaveTypeNameExistence(name, null);

    // Add the new leave type (By default, the status will be "Active")
    const newLeaveType = await LeaveType.create({
      name,
      description,
      isPaid,
    });

    // Logging the action
    try {
      await logAuditAction({
        adminId: req.user.id,
        action: "CREATE_LEAVE_TYPE",
        targetType: "LeaveType",
        targetId: newLeaveType._id,
        targetName: newLeaveType.name,
        ipAddress: req.ip,
      });
    } catch (logErr) {
      console.log("[AUDIT-LOG-ERROR]", logErr.message);
    }

    res.status(201).json({
      status: "Success",
      message: "Leave type created successfully!",
      result: newLeaveType,
    });
  } catch (err) {
    next(err);
  }
};

// Update an existing Leave Type (Admin only)
export const updateLeaveType = async (req, res, next) => {
  try {
    const { id } = req.params;
    let { name, description, isPaid } = req.body;

    // Check the leave type existance
    const existingLeaveType = await LeaveType.findById(id);
    if (!existingLeaveType) {
      throw new AppError("Leave type not found!", 404);
    }

    // Prevent updating an archived leave type
    if (existingLeaveType.status === "Archived") {
      throw new AppError(
        "Cannot update an archived leave type. Restore it first!",
        400,
      );
    }

    const updateData = {};

    // Update name (if provided)
    if (name) {
      name = await validateLeaveTypeName(name);
      await checkLeaveTypeNameExistence(name, id);
      updateData.name = name.trim();
    }

    // Update description (if provided)
    if (description !== undefined) {
      updateData.description = description;
    }

    // Update isPaid (if provided)
    if (isPaid !== undefined) {
      updateData.isPaid = isPaid;
    }

    const updatedLeaveType = await LeaveType.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
      runValidators: true,
    });

    // Logging the action
    try {
      await logAuditAction({
        adminId: req.user.id,
        action: "UPDATE_LEAVE_TYPE",
        targetType: "LeaveType",
        targetId: updatedLeaveType._id,
        targetName: updatedLeaveType.name,
        ipAddress: req.ip,
      });
    } catch (logErr) {
      console.log("[AUDIT-LOG-ERROR]", logErr.message);
    }

    res.status(200).json({
      status: "Success",
      message: "Leave type updated successfully!",
      result: updatedLeaveType,
    });
  } catch (err) {
    next(err);
  }
};

// Archive a leave type (Admin only)
export const archiveLeaveType = async (req, res, next) => {
  try {
    const { id } = req.params; // Leave type ID

    // Check the leave type existance
    const existingLeaveType = await LeaveType.findById(id);
    if (!existingLeaveType) {
      throw new AppError("Leave type not found!", 404);
    }

    // Check if the leave type is already archived
    if (existingLeaveType.status === "Archived") {
      throw new AppError("Leave type is already archived!", 400);
    }

    // Archive the leave type
    existingLeaveType.status = "Archived";
    await existingLeaveType.save();

    // Logging the action
    try {
      await logAuditAction({
        adminId: req.user.id,
        action: "ARCHIVE_LEAVE_TYPE",
        targetType: "LeaveType",
        targetId: existingLeaveType._id,
        targetName: existingLeaveType.name,
        ipAddress: req.ip,
      });
    } catch (logErr) {
      console.log("[AUDIT-LOG-ERROR]", logErr.message);
    }

    res.status(200).json({
      status: "Success",
      message: "Leave type archived successfully!",
      result: existingLeaveType,
    });
  } catch (err) {
    next(err);
  }
};

// Restore an archived leave type (Admin only)
export const restoreLeaveType = async (req, res, next) => {
  try {
    const { id } = req.params; // Leave type ID

    // Check the leave type existance
    const existingLeaveType = await LeaveType.findById(id);
    if (!existingLeaveType) {
      throw new AppError("Leave type not found!", 404);
    }

    // Check if the leave type is already active
    if (existingLeaveType.status === "Active") {
      throw new AppError("Leave type is already active!", 400);
    }

    // Restore the leave type
    existingLeaveType.status = "Active";
    await existingLeaveType.save();

    // Logging the action
    try {
      await logAuditAction({
        adminId: req.user.id,
        action: "RESTORE_LEAVE_TYPE",
        targetType: "LeaveType",
        targetId: existingLeaveType._id,
        targetName: existingLeaveType.name,
        ipAddress: req.ip,
      });
    } catch (logErr) {
      console.log("[AUDIT-LOG-ERROR]", logErr.message);
    }

    res.status(200).json({
      status: "Success",
      message: "Leave type restored successfully!",
      result: existingLeaveType,
    });
  } catch (err) {
    next(err);
  }
};

// Get all active leave types
export const getAllActiveLeaveTypes = async (req, res, next) => {
  try {
    // Sort the leave types by creation date (newest first)
    const leaveTypes = await LeaveType.find({ status: "Active" }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      status: "Success",
      totalActiveLeaveTypes: leaveTypes.length,
      result: leaveTypes,
    });
  } catch (err) {
    next(err);
  }
};

// Get all archived leave types
export const getAllArchivedLeaveTypes = async (req, res, next) => {
  try {
    // Sort the leave types by creation date (newest first)
    const leaveTypes = await LeaveType.find({ status: "Archived" }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      status: "Success",
      totalArchivedLeaveTypes: leaveTypes.length,
      result: leaveTypes,
    });
  } catch (err) {
    next(err);
  }
};
