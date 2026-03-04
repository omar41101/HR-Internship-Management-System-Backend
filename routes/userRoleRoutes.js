import express from "express";
import {
    addUserRole,
    getAllUserRoles,
    getUserRoleById,
    deleteUserRole,
    updateUserRole
} from "../controllers/userRoleController.js";
import authorizeRole from "../middleware/rolePermission.js";

const router = express.Router();

/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Add a new user role
 *     description: Create a new role (Admin only)
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRole'
 *     responses:
 *       201:
 *         description: Role created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserRole'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       500:
 *         description: Server error
 */
router.post("/roles", authorizeRole("Admin"), addUserRole);

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: Get all user roles
 *     description: Retrieve a list of all roles
 *     tags:
 *       - Roles
 *     responses:
 *       200:
 *         description: List of roles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserRole'
 *       500:
 *         description: Server error
 */
router.get("/roles", getAllUserRoles); 

/**
 * @swagger
 * /api/roles/{id}:
 *   get:
 *     summary: Get role by ID
 *     description: Retrieve a specific role by its ID
 *     tags:
 *       - Roles
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserRole'
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
router.get("/roles/:id", getUserRoleById);

/**
 * @swagger
 * /api/roles/{id}:
 *   delete:
 *     summary: Delete a user role
 *     description: Delete a role by ID (Admin only)
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
router.delete("/roles/:id", authorizeRole("Admin"), deleteUserRole);

/**
 * @swagger
 * /api/roles/{id}:
 *   put:
 *     summary: Update a user role
 *     description: Update a role by ID (Admin only)
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRole'
 *     responses:
 *       200:
 *         description: Role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserRole'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
router.put("/roles/:id", authorizeRole("Admin"), updateUserRole);

export default router;