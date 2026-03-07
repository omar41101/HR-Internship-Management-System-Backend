import UserRole from "../models/UserRole.js";
import User from "../models/User.js";
import { logAuditAction } from "../utils/logger.js";

// Add new Role Functionnality 
export const addUserRole = async (req, res) => {
  // Get the new role credentials
  const { name, description } = req.body; 

  // Check for empty name field (required)
  if (!name || name.trim() === "") {
    return res.status(400).json({
      status: "Error",
      message: "The name field must be filled!",
    });
  }

  try {
    // Check for user role name existence
    const existingUserRoleName = await UserRole.findOne({ name: name.trim() });
    if (
      existingUserRoleName &&
      existingUserRoleName._id.toString() !== req.params.id
    ) {
      return res.status(400).json({
        status: "Error",
        message: "User Role already exists!",
      });
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
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Get All Roles Functionnality
export const getAllUserRoles = async (req, res) => {
  try {
    const userRoles = await UserRole.find();
    res.status(200).json(userRoles);
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Get a Role by Id
export const getUserRoleById = async (req, res) => {
  try {
    const userRole = await UserRole.findById(req.params.id);
    if (!userRole) {
      return res.status(404).json({
        status: "Error",
        message: "User Role not found!",
      });
    }

    res.status(200).json(userRole);
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Delete a User Role (All admins can do it)
export const deleteUserRole = async (req, res) => {
  try {
    // Check for user role existence
    const userRole = await UserRole.findById(req.params.id);
    if (!userRole) {
      return res.status(404).json({
        status: "Error",
        message: "User Role is not found!",
      });
    }

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
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Update a User Role
export const updateUserRole = async (req, res) => {
  const { name, description } = req.body;

  // Check for empty name field (required)
  if (!name || name.trim() === "") {
    return res.status(400).json({
      status: "Error",
      message: "The name field must be filled!",
    });
  }

  try {
    // Check for user role existence
    const userRole = await UserRole.findById(req.params.id);
    if (!userRole) {
      return res.status(404).json({
        status: "Error",
        message: "User Role not found!",
      });
    }

    // Check for user role name existence
    const existingUserRole = await UserRole.findOne({ name: name.trim() });
    if (existingUserRole && existingUserRole._id.toString() !== req.params.id) {
      return res.status(400).json({
        status: "Error",
        message: "User Role name already exists!",
      });
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
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};
