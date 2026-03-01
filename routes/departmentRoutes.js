import express from "express";
import {
    addDepartment,
    getAllDepartments,
    getDepartmentById,
    deleteDepartment,
    updateDepartment
} from "../controllers/departmentController.js";
import authorizeRole from "../middleware/rolePermission.js";

const router = express.Router();

// Route to add new department
router.post("/departments", authorizeRole("Admin"), addDepartment);

// Route to get all the departments
router.get("/departments", getAllDepartments); 

// Route to get a department by id
router.get("/departments/:id", getDepartmentById);

// Route to delete a department
router.delete("/departments/:id", authorizeRole("Admin"), deleteDepartment);

// Route to update a department
router.put("/departments/:id", authorizeRole("Admin"), updateDepartment);

export default router;