import express from "express";
import {
  login,
  addUser,
  updateUser,
  deleteUser,
  getAllUsers,
  getActiveSupervisors,
  getRecentSupervisors,
  getUserById,
  searchUser,
  filterUsers,
  toggleUserStatus,
  exportUsersToCSV,
  exportUsersToExcel,
  uploadProfileImage,
  removeProfileImage,
  enrollFace,
  resetFace,
  getPublicInterns,
  getTeamMembers,
} from "../controllers/userController.js";
import { upload } from "../middleware/upload.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
 
const router = express.Router();

/**
 * @swagger
  * /api/v0/users:
 *   post:
 *     summary: Add a new user
 *     description: Create a new user account
 *     tags:
 *       - Users
 */

// -------------------------------------------------------------------------------------- //
// ------------------------------- USER MANAGEMENT ROUTES ------------------------------- //
// -------------------------------------------------------------------------------------- //

// Public interns listing for marketing site
router.get("/public/interns", getPublicInterns);

// Route to Add user (Admin Only)
/**
 * @swagger
 * /api/v0/users:
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
  *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post("/users", addUser);

/**
 * @swagger
 * /api/v0/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user and return JWT token
 *     tags:
 *       - Users
  *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Failed Input validation
 *       401:
 *         description: Unauthorized (User existing, Invalid Role, Invalid Department or Invalid/missing token)
 *       403:
 *         description: Forbidden (Insufficient permissions)
 *       404:
 *         description: Supervisor not found
 *       409:
 *         description: User already exists in the DB
 *       500:
 *         description: Server error
 */
router.post("/users", authenticate, authorize(["Admin"]), addUser);

// Route to Update user (Edit Profile) (Admin Only and the user himself)
/**
 * @swagger
 * /api/v0/users/{id}:
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
  *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
  *             $ref: '#/components/schemas/UpdateUserRequest'
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Input Validation failed, Invalid Role, Invalid Department, Invalid Supervisor or Invalid/missing token
 *       403:
 *         description: Forbidden (Insufficient permissions)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put("/users/:id", authenticate, authorize(["Admin"], { allowSelf: true }), updateUser);

// Route to Delete user (Admin Only)
/**
 * @swagger
 * /api/v0/users/{id}:
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
router.delete("/users/:id", authenticate, authorize(["Admin"]), deleteUser);

// Route to get all users (Admin Only)
/**
 * @swagger
 * /api/v0/users:
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
router.get("/users", authenticate, authorize(["Admin", "Supervisor", "Employee", "Intern"]), getAllUsers);

// Route to get active supervisors (Admin Only)
/**
 * @swagger
 * /api/v0/users/active-supervisors:
 *  get:
 *    summary: Get all active supervisors (Admin only)
 *    tags:
 *     - Users
 *    description: Returns a list of all active supervisors in the system.
 *  security:
 *    - bearerAuth: []
 *  responses:
 *   200:
 *    description: Returns list of available and active supervisors
 *   500:
 *    description: Server error
 * */
router.get("/users/active-supervisors", authenticate, authorize(["Admin"]), getActiveSupervisors);

// Route to get the 3 recent supervisors (Admin Only)
router.get("/users/recent-supervisors", authenticate, authorize(["Admin"]), getRecentSupervisors);

// Route to get user by ID (Admin, the user himself and his supervisor)
/**
 * @swagger
 * /api/v0/users/{id}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get a user by ID (Admin and the user himself)
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
 *         description: Returns the user data
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get(
  "/users/:id",
  authenticate,
  getUserById
);

// Route to search users
/**
 * @swagger
 * /api/v0/users/search:
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
router.get("/search", authenticate, authorize(["Admin"]), searchUser);

// Route to filter users
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
 *           enum: [Active, Inactive, Pending, Blocked]
 *     responses:
 *       200:
 *         description: Returns filtered users
 *       400:
 *         description: Invalid Role or Department
 *       500:
 *         description: Server error
 */
router.get("/filter", authenticate, authorize(["Admin"]), filterUsers);

// Route to toggle user status
/**
 * @swagger
 * /api/users/{id}/toggle-status:
 *   put:
 *     tags:
 *       - Users
 *     summary: Toggle user Active/Inactive status (Admin only)
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
router.put("/users/:id/toggle-status", authenticate, authorize(["Admin"]), toggleUserStatus);

// Route to export users to CSV
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
router.get("/users/export/csv", authenticate, authorize(["Admin"]), exportUsersToCSV);

// Route to export users to Excel
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
router.get("/users/export/excel", authenticate, authorize(["Admin"]), exportUsersToExcel);

// Route to upload profile image
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
 *         description: Profile Image uploaded successfully
 *       400:
 *         description: No file uploaded
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  "/users/:id/profile-image",
  authenticate,
  authorize(["Admin"], { allowSelf: true }),
  upload("image").single("profileImage"),
  uploadProfileImage
);

// Route to delete profile image
/**
 * @swagger
 * /api/users/{id}/profile-image:
 *   delete:
 *     summary: Remove a user's profile image (Admin Only and the user himself)
 *     description: Deletes the user's profile image from Cloudinary and removes it from the user's profile.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the user whose profile image will be removed
 *         schema:
 *           type: string
 *           example: 6652b9b7c87f2a8a4f5d1a2c
  *     responses:
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized (Insufficient permissions)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.delete(
  "/users/:id/profile-image",
  authenticate,
  authorize(["Admin"], { allowSelf: true }),
  removeProfileImage
);

// Route to enroll face descriptors
/**
 * @swagger
 * /api/users/{id}/face-enrollment:
 *   post:
 *     summary: Enroll face descriptors for a user (Admin Only and the user himself)
 *     description: Saves the face descriptors captured during enrollment to the user's profile.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the user to enroll face for
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - descriptors
 *             properties:
 *               descriptors:
 *                 type: array
 *                 items:
 *                   type: array
 *                   items:
 *                     type: number
 *                 description: Array of face descriptors (each is an array of 128 numbers)
 *     responses:
 *       200:
 *         description: Face descriptors enrolled successfully
 *       400:
 *         description: Invalid descriptions data
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized (Insufficient permissions)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 *     
 */
router.post(
  "/users/:id/face-enrollment",
  authenticate,
  authorize(["Admin"], { allowSelf: true }),
  enrollFace
);

// Route to reset face descriptors
/**
 * @swagger
 * /users/{id}/reset-face:
 *   post:
 *     summary: Reset a user's Face ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user whose Face ID will be reset
 *     description: |
 *       Admins can reset the Face ID of any user. Users can reset their own Face ID if `allowSelf` is enabled.
 *       This clears the `faceDescriptors` array and sets `faceEnrolled` to `false`.
 *     responses:
 *       200:
 *         description: Face ID reset successfully
  *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
  *                 token:
 *                   type: string
 *                   description: JWT token
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post("/login", login);   
router.post(
  "/users/:id/reset-face",
  authenticate,
  authorize(["Admin"], { allowSelf: true }),
  resetFace
);

// -------------------------------------------------------------------------------------- //
// ----------------------------- TEAM MANAGEMENT ROUTES --------------------------------- //
// -------------------------------------------------------------------------------------- //

// Route to get team members (Supervisor/admin only)
router.get(
  "/users/team/:id",  
  authenticate,
  authorize(["Admin", "Supervisor"], { allowSelf: true }),
  getTeamMembers
);

export default router; 
  

 