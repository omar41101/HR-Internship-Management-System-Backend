import express from "express";
import {
<<<<<<< HEAD
    addUserRole,
    getAllUserRoles,
    getUserRoleById,
    deleteUserRole,
    updateUserRole
} from "../controllers/userRoleController.js";
import authorizeRole from "../middleware/rolePermission.js";
=======
  addUserRole,
  getAllUserRoles,
  getUserRoleById,
  updateUserRole,
  deleteUserRole,
} from "../controllers/userRoleController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
>>>>>>> sprint1

const router = express.Router();

/**
 * @swagger
<<<<<<< HEAD
 * /api/roles:
 *   post:
 *     summary: Add a new user role
 *     description: Create a new role (Admin only)
 *     tags:
 *       - Roles
=======
 * tags:
 *   - name: UserRoles
 *     description: Endpoints for the user roles CRUDs
 */

// Add new role
/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Create a new user role (Admin Only)
 *     tags:
 *       - UserRoles
 *     description: Allows the Admin to add new user role.
>>>>>>> sprint1
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
<<<<<<< HEAD
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

=======
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
 *       400:
 *         description: Role Name must be filled | Role already exists
 *       401:
 *         description: Missing Token
 *       403:
 *         description: Unauthorized
 *       500:
 *         description: Server Error
 */
router.post("/roles", authenticate, authorize(["Admin"]), addUserRole);

// Get all roles
>>>>>>> sprint1
/**
 * @swagger
 * /api/roles:
 *   get:
<<<<<<< HEAD
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

=======
 *     summary: Get all user roles (Admin only)
 *     tags:
 *       - UserRoles
 *     description: Allows an Admin to get the list of all user roles.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns list of roles
 *       401:
 *         description: Missing Token
 *       403:
 *         description: Unauthorized
 *       500:
 *         description: Server Error
 */
router.get("/roles", authenticate, authorize(["Admin", "Supervisor"]), getAllUserRoles);

// Get a role by ID
>>>>>>> sprint1
/**
 * @swagger
 * /api/roles/{id}:
 *   get:
<<<<<<< HEAD
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
=======
 *     summary: Get a user role by ID (Admin only)
 *     tags:
 *       - UserRoles
 *     description: Allows an Admin to get the details of a user role.
>>>>>>> sprint1
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
<<<<<<< HEAD
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

=======
 *         description: ID of the role to retrieve
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns the user role details
 *       401:
 *         description: Missing Token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server Error
 */
router.get("/roles/:id", authenticate, authorize(["Admin"]), getUserRoleById);

// Update a role
>>>>>>> sprint1
/**
 * @swagger
 * /api/roles/{id}:
 *   put:
<<<<<<< HEAD
 *     summary: Update a user role
 *     description: Update a role by ID (Admin only)
 *     tags:
 *       - Roles
=======
 *     summary: Update a user role (Admin only)
 *     tags:
 *       - UserRoles
 *     description: Allows an Admin to update the details of a user role.
>>>>>>> sprint1
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
<<<<<<< HEAD
 *         schema:
 *           type: string
 *         description: Role ID
=======
 *         description: ID of the role to update
 *         schema:
 *           type: string
>>>>>>> sprint1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
<<<<<<< HEAD
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
=======
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
 *         description: Invalid input | User Role already exists
 *       401:
 *         description: Missing Token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: User Role not found
 *       500:
 *         description: Server Error
 */
router.put("/roles/:id", authenticate, authorize(["Admin"]), updateUserRole);

// Delete a role
/**
 * @swagger
 * /api/roles/{id}:
 *   delete:
 *     summary: Delete a user role (Admin only)
 *     tags:
 *       - UserRoles
 *     description: Allows an Admin to delete a user role.
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
 *         description: User Role deleted successfully
 *       401:
 *         description: Missing Token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: User Role not found
 *       500:
 *         description: Server Error
 */
router.delete("/roles/:id", authenticate, authorize(["Admin"]), deleteUserRole);

export default router;
>>>>>>> sprint1
