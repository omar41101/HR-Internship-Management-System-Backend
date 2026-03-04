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
/**
 * @swagger
 * /api/departments:
 *   post:
 *     tags:
 *       - Departments
 *     summary: Create a new department
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Department created
 */
router.post("/departments", authorizeRole("Admin"), addDepartment);

// Route to get all the departments
/**
 * @swagger
 * /api/departments:
 *   get:
 *     tags:
 *       - Departments
 *     summary: Get all departments
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of departments
 */
router.get("/departments", getAllDepartments); 

// Route to get a department by Id
/**
 * @swagger
 * /api/departments/{id}:
 *   get:
 *     tags:
 *       - Departments
 *     summary: Get a single department by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Department details
 *       404:
 *         description: Department not found
 */
router.get("/departments/:id", getDepartmentById);

// Route to delete a department
/**
 * @swagger
 * /api/departments/{id}:
 *   delete:
 *     tags:
 *       - Departments
 *     summary: Delete a department
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Department deleted
 *       404:
 *         description: Department not found
 */
router.delete("/departments/:id", authorizeRole("Admin"), deleteDepartment);

// Route to update a department
/**
 * @swagger
 * /api/departments/{id}:
 *   put:
 *     tags:
 *       - Departments
 *     summary: Update a department
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Department updated
 *       404:
 *         description: Department not found
 */
router.put("/departments/:id", authorizeRole("Admin"), updateDepartment);

export default router;