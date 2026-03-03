// Importations
import UserRole from "../models/UserRole.js";
import { generateRoleCode } from "../middleware/roleService.js";
import bcrypt from "bcrypt";

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

    // Generate new code for the role
    const generatedCode = await generateRoleCode();
    const hashedCode = await bcrypt.hash(generatedCode.toString(), 10); // Hash the generated code

    // Save the new user role in the Database
    let userRole = await UserRole.create({
      name,
      description,
      code: hashedCode,
    });

    return res.status(201).json({
      status: "Success",
      data: { code: generatedCode, userRole },
    });
  } 
  catch (err) {
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
    const userRole = await UserRole.findById(req.params.id);
    if (!userRole) {
      return res.status(404).json({
        status: "Error",
        message: "User Role is not found!",
      });
    }

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

  try {
    const userRole = await UserRole.findById(req.params.id);
    if (!userRole) {
      return res.status(404).json({
        status: "Error",
        message: "User Role not found!",
      });
    }

    // Update User Role
    const userRoleToUpdate = await UserRole.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
      },
      { new: true },
    );
    res.status(200).json(userRoleToUpdate);
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};
