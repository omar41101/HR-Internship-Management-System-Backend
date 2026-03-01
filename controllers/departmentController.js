// Importations
import Department from "../models/Department.js";

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
    // Save the new department in the Database
    let department = await Department.create({
      name,
      description,
    });

    return res.status(201).json({
      status: "Success",
      data: { department },
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
    try{
        const departments = await Department.find();
        res.status(200).json(departments);
    }
    catch(err){
        res.status(500).json({
            status: "Error",
            message: err.message
        });
    }
};


// Get a Department by Id
export const getDepartmentById = async (req, res) => {
    try{
        const department = await Department.findById(req.params.id);
        if(!department){
            return res.status(404).json({
                status: "Error",
                message: "Department not found!"
            });
        }

        res.status(200).json(department);
    }
    catch(err){
        res.status(500).json({
            status: "Error",
            message: err.message
        });
    }
};


// Delete a Department (All admins can do it)
export const deleteDepartment = async (req, res) => {
    try{
        const department = await Department.findById(req.params.id);
        if(!department){
            return res.status(404).json({
                status: "Error",
                message: "Department is not found!"
            });
        }

        // Delete the department
        await Department.findByIdAndDelete(req.params.id);
        res.status(200).json({
            status: "Success",
            message: "Department Deleted Successfully!"
        });
    }
    catch(err){
        res.status(500).json({
            status: "Error",
            message: err.message
        });
    }
};


// Update a Department
export const updateDepartment = async (req, res) => {
    const {name, description} = req.body;

    try{
        const department = await Department.findById(req.params.id);
        if(!department){
            return res.status(404).json({
                status: "Error",
                message: "Department not found!"
            });
        }

        // Update Department
        const departmentToUpdate = await Department.findByIdAndUpdate(
            req.params.id,
            {
                name,
                description
            },
            {new: true}
        );
        res.status(200).json(departmentToUpdate);
    }
    catch(err){
        res.status(500).json({
            status: "Error",
            message: err.message
        });
    }
};