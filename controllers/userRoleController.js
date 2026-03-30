import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import { logAuditAction } from "../utils/logger.js";
import AppError from "../utils/AppError.js";

// Add new Role Functionnality 
export const addUserRole = async (req, res, next) => {
  // Get the new role credentials
  const { name, description } = req.body;

  // Check for empty name field (required)
  if (!name || name.trim() === "") {
    throw new AppError("The name field must be filled!", 400);
  }

  try {
    // Check for user role name existence
    const existingUserRoleName = await UserRole.findOne({ name: name.trim() });
    if (
      existingUserRoleName &&
      existingUserRoleName._id.toString() !== req.params.id
    ) {
      throw new AppError("User Role already exists!", 400);
    }

    // Save the new user role in the Database
    let userRole = await UserRole.create({
      name,
      description,
    });

    res.status(201).json({
      status: "Success",
      data: { userRole },
    });

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "CREATE_ROLE",
      targetType: "UserRole",
      targetId: userRole._id,
      targetName: userRole.name,
      ipAddress: req.ip,
    });
  } catch (err) {
    next(err);
  }
};

// Get All Roles Functionnality
export const getAllUserRoles = async (req, res, next) => {
  try {
    const { page = 1} = req.query;

    const limit = 4; // 4 roles per page
    const parsedPage = Math.max(parseInt(page), 1);

    const skip = (parsedPage - 1) * limit; 

    // Get the total roles 
    const totalRoles = await UserRole.countDocuments();

    // Fetch the paginated roles
    const userRoles = await UserRole.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }); // Sort the roles by creation date (newest first)

    res.status(200).json({
      status: "Success",
      totalRoles: totalRoles,
      page: parsedPage,
      limit: limit,
      roles: userRoles,
    });
  } catch (err) {
    next(err);
  }
};

// Get a Role by Id
export const getUserRoleById = async (req, res, next) => {
  try {
    const userRole = await UserRole.findById(req.params.id);
    if (!userRole) throw new AppError("User Role not found!", 404);

    res.status(200).json(userRole);
  } catch (err) {
    next(err);
  }
};

// Delete a User Role (All admins can do it)
export const deleteUserRole = async (req, res, next) => {
  try {
    // Check for user role existence
    const userRole = await UserRole.findById(req.params.id);
    if (!userRole) throw new AppError("User Role is not found!", 404);

    // Find the role and create if missing
    let notAssignedRole = await UserRole.findOne({ name: "Not assigned" });
    if (!notAssignedRole) {
      notAssignedRole = await UserRole.create({
        name: "Not assigned",
        description: "Default role for unassigned users",
      });
    }

    // Reassign users having the deleted role to "Not assigned"
    await User.updateMany(
      { role_id: userRole._id },
      { $set: { role_id: notAssignedRole._id } },
    );

    // Delete user role
    await UserRole.findByIdAndDelete(req.params.id);
    res.status(200).json({
      status: "Success",
      message: "User Role Deleted Successfully!",
    });

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "DELETE_ROLE",
      targetType: "UserRole",
      targetId: userRole._id,
      targetName: userRole.name,
      ipAddress: req.ip,
    });
  } catch (err) {
    next(err);
  }
};

// Update a User Role
export const updateUserRole = async (req, res, next) => {
  const { name, description } = req.body;

  // Check for empty name field (required)
  if (!name || name.trim() === "") {
    throw new AppError("The name field must be filled!", 400);
  }

  try {
    // Check for user role existence
    const userRole = await UserRole.findById(req.params.id);
    if (!userRole) throw new AppError("User Role not found!", 404);

    // Check for user role name existence
    const existingUserRole = await UserRole.findOne({ name: name.trim() });
    if (existingUserRole && existingUserRole._id.toString() !== req.params.id) {
      throw new AppError("User Role name already exists!", 400);
    }

    // Get the old role name
    const oldRoleName = userRole.name;

    // Update User Role
    const userRoleToUpdate = await UserRole.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
      },
      { returnDocument: "after" },
    );

    // Update users having this role with the new role name
    await User.updateMany(
      { role: oldRoleName },
      { role: userRoleToUpdate.name },
    );

    res.status(200).json(userRoleToUpdate);

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "UPDATE_ROLE",
      targetType: "UserRole",
      targetId: userRoleToUpdate._id,
      targetName: userRoleToUpdate.name,
      details: req.body,
      ipAddress: req.ip,
    });
  } catch (err) {
    next(err);
  }
};
