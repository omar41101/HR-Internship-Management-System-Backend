// Importations
import UserRole from "../models/UserRole.js";
import User from "../models/User.js";
import { generateRoleCode } from "../middleware/roleService.js";
import { encrypt } from "../utils/cryptoUtils.js";

// Add new Role Functionnality
export const addUserRole = async (req, res) => {
  const { name, description } = req.body; // Get the new role credentials

  // Check for empty name field (required)
  if (!name || name.trim() === "") {
    return res.status(400).json({
      status: "Error",
      message: "The name field must be filled!",
    });
  }

  try {
    // Check for role existence
    const existingRole = await UserRole.findOne({ name: name.trim() });
    if (existingRole) {
      return res.status(400).json({
        status: "Error",
        message: "User Role already existing!",
      });
    }

    // Check for user role name existence
    const existingUserRoleName = await UserRole.findOne({ name: name.trim() });
    if (
      existingUserRoleName &&
      existingUserRoleName._id.toString() !== req.params.id
    ) {
      return res.status(400).json({
        status: "Error",
        message: "User Role name already exists!",
      });
    }

    // Generate new code for the role
    const generatedCode = await generateRoleCode();
    const encryptedCode = encrypt(generatedCode.toString()); // Encrypt the user role code

    // Save the new user role in the Database
    let userRole = await UserRole.create({
      name,
      description,
      code: encryptedCode,
    });

    return res.status(201).json({
      status: "Success",
      data: { code: generatedCode, userRole },
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

    // Find the "Not assigned" role and create it if it doesn't exist
    let notAssignedRole = await UserRole.findOne({ name: "Not assigned" });
    if (!notAssignedRole) {
      notAssignedRole = await UserRole.create({
        name: "Not assigned",
        description: "Default role for unassigned users",
        code: "000",
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
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};
