import express from "express";
import {
  login,
  addUser,
  updateUser,
  deleteUser,
  getAllUsers,
  getUserById,
  searchUser,
  filterUsers,
  toggleUserStatus,
  exportUsersToCSV,
  exportUsersToExcel,
  uploadProfileImage,
  verifyUser,
  resendVerificationCode
} from "../controllers/userController.js";
import { upload } from "../middleware/upload.js";
import authorizeRole from "../middleware/rolePermission.js";

const router = express.Router();

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: User Login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Successful login
 *       404:
 *         description: User not found
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post("/login", login);

/**
 * @swagger
 * /api/users:
 *   post:
 *     tags:
 *       - Users
 *     summary: Add a new user (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Failed Input validation
 *       401:
 *         description: Unauthorized (User existing or invalid/missing token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: User/Role/Department/Supervisor not found
 *       500:
 *         description: Server error
 */
router.post("/users", authorizeRole("Admin"), addUser);

// Route to verify user's OTP code
router.post("/users/verify-user", verifyUser);

// Route to resend OTP code
router.post("/users/resend-verification", resendVerificationCode);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     tags:
 *       - Users
 *     summary: Update an existing user (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserRequest'
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Validation failed
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put("/users/:id", authorizeRole("Admin"), updateUser);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags:
 *       - Users
 *     summary: Delete a user (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete("/users/:id", authorizeRole("Admin"), deleteUser);

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get all users (Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns list of users
 *       500:
 *         description: Server error
 */
router.get("/users", authorizeRole("Admin"), getAllUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get a user by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns the user data
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get("/users/:id", getUserById);

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     tags:
 *       - Users
 *     summary: Search users by name or email (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         description: Query string
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns matching users
 *       500:
 *         description: Server error
 */
router.get("/search", authorizeRole("Admin"), searchUser);

/**
 * @swagger
 * /api/users/filter:
 *   get:
 *     tags:
 *       - Users
 *     summary: Filter users by role, department, or status (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: role
 *         in: query
 *         schema:
 *           type: string
 *       - name: department
 *         in: query
 *         schema:
 *           type: string
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [Active, Inactive]
 *     responses:
 *       200:
 *         description: Returns filtered users
 *       400:
 *         description: Invalid role or department
 *       500:
 *         description: Server error
 */
router.get("/filter", authorizeRole("Admin"), filterUsers);

/**
 * @swagger
 * /api/users/{id}/toggle-status:
 *   put:
 *     tags:
 *       - Users
 *     summary: Toggle user active/inactive status (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status toggled successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put("/users/:id/toggle-status", authorizeRole("Admin"), toggleUserStatus);

/**
 * @swagger
 * /api/users/export/csv:
 *   get:
 *     tags:
 *       - Users
 *     summary: Export all users to CSV (Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file
 *       500:
 *         description: Server error
 */
router.get("/users/export/csv", authorizeRole("Admin"), exportUsersToCSV);

/**
 * @swagger
 * /api/users/export/excel:
 *   get:
 *     tags:
 *       - Users
 *     summary: Export all users to Excel (Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file
 *       500:
 *         description: Server error
 */
router.get("/users/export/excel", authorizeRole("Admin"), exportUsersToExcel);

/**
 * @swagger
 * /api/users/{id}/profile-image:
 *   post:
 *     tags:
 *       - Users
 *     summary: Upload a profile image for a user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profileImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile image uploaded successfully
 *       400:
 *         description: No file uploaded
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post("/users/:id/profile-image", upload.single("profileImage"), uploadProfileImage);

export default router;