import express from "express";
import {
  addUserRole,
  getAllUserRoles,
  getUserRoleById,
  updateUserRole,
  deleteUserRole,
} from "../controllers/userRoleController.js";
import authorizeRole from "../middleware/rolePermission.js";

const router = express.Router();

// Add new role
/**
 * @swagger
 * /api/roles:
 *   post:
 *     tags:
 *       - UserRoles
 *     summary: Add a new user role (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: 
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Role created successfully
 */
router.post("/roles", authorizeRole("Admin"), addUserRole);

// Get all roles
/**
 * @swagger
 * /api/roles:
 *   get:
 *     tags:
 *       - UserRoles
 *     summary: Get all user roles
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns list of roles
 */
router.get("/roles", authorizeRole("Admin"), getAllUserRoles);

// Get a role by ID
/**
 * @swagger
 * /api/roles/{id}:
 *   get:
 *     tags:
 *       - UserRoles
 *     summary: Get a single user role by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the role to retrieve
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns the user role
 *       404:
 *         description: Role not found
 */
router.get("/roles/:id", authorizeRole("Admin"), getUserRoleById);

// Update a role
/**
 * @swagger
 * /api/roles/{id}:
 *   put:
 *     tags:
 *       - UserRoles
 *     summary: Update a user role (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the role to update
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
 *         description: Role updated successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Role not found
 */
router.put("/roles/:id", authorizeRole("Admin"), updateUserRole);

// Delete a role
/**
 * @swagger
 * /api/roles/{id}:
 *   delete:
 *     tags:
 *       - UserRoles
 *     summary: Delete a user role (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the role to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *       404:
 *         description: Role not found
 */
router.delete("/roles/:id", authorizeRole("Admin"), deleteUserRole);

export default router;