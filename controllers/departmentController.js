import Department from "../models/Department.js";
import User from "../models/User.js";
import { logAuditAction } from "../utils/logger.js";

// Add new Department Functionnality
export const addDepartment = async (req, res) => {
  const { name, description } = req.body; // Get the new department credentials

  // Check empty name field (required)
  if (!name || name.trim() === "") {
    return res.status(400).json({
      status: "Error",
      message: "The department name field must be filled!",
    });
  }

  try {
    // Check for department existence
    const existingDepartment = await Department.findOne({ name: name.trim() });
    if (existingDepartment) {
      return res.status(400).json({
        status: "Error",
        message: "Department already existing!",
      });
    }

    // Check for department name existence
    const existingDepartmentName = await Department.findOne({ name: name.trim() });
    if (
      existingDepartmentName &&
      existingDepartmentName._id.toString() !== req.params.id
    ) {
      return res.status(400).json({
        status: "Error",
        message: "Department name already exists!",
      });
    }

    // Save the new department in the Database
    let department = await Department.create({
      name,
      description,
    });

    res.status(201).json({
      status: "Success",
      data: { department },
    });

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "CREATE_DEPARTMENT",
      targetType: "Department",
      targetId: department._id,
      targetName: department.name,
      ipAddress: req.ip,
    });
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Get All Departments Functionnality
export const getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find();
    res.status(200).json(departments);
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Get a Department by Id
export const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({
        status: "Error",
        message: "Department not found!",
      });
    }

    res.status(200).json(department);
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Delete a Department (All admins can do it)
export const deleteDepartment = async (req, res) => {
  try {
    // Check for department existence
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({
        status: "Error",
        message: "Department is not found!",
      });
    }

    // Find the "Not assigned" department and create it if it doesn't exist
    let notAssignedDepartment = await Department.findOne({
      name: "Not assigned",
    });
    if (!notAssignedDepartment) {
      notAssignedDepartment = await Department.create({
        name: "Not assigned",
        description: "Default department for unassigned users",
      });
    }

    // Reassign users having the deleted department to "Not assigned"
    await User.updateMany(
      { department_id: department._id },
      { $set: { department_id: notAssignedDepartment._id } },
    );

    // Delete the department
    await Department.findByIdAndDelete(req.params.id);
    res.status(200).json({
      status: "Success",
      message: "Department Deleted Successfully!",
    });

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "DELETE_DEPARTMENT",
      targetType: "Department",
      targetId: department._id,
      targetName: department.name,
      ipAddress: req.ip,
    });
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Update a Department
export const updateDepartment = async (req, res) => {
  const { name, description } = req.body;

  // Check for empty name field (required)
  if (!name || name.trim() === "") {
    return res.status(400).json({
      status: "Error",
      message: "The name field must be filled!",
    });
  }

  try {
    // Check for department existence
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({
        status: "Error",
        message: "Department not found!",
      });
    }

    // Check for department name existence
    const existingDepartment = await Department.findOne({ name: name.trim() });
    if (
      existingDepartment &&
      existingDepartment._id.toString() !== req.params.id
    ) {
      return res.status(400).json({
        status: "Error",
        message: "Department name already exists!",
      });
    }

    // Get the old department name
    const oldDepartmentName = department.name;

    // Update Department
    const departmentToUpdate = await Department.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
      },
      { returnDocument: "after" },
    );

    // Update users having this department with the new department name
    await User.updateMany(
      { department: oldDepartmentName },
      { department: departmentToUpdate.name },
    );
    res.status(200).json(departmentToUpdate);

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "UPDATE_DEPARTMENT",
      targetType: "Department",
      targetId: departmentToUpdate._id,
      targetName: departmentToUpdate.name,
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
