import express from "express";
import {
  checkIn,
  checkOut,
  getAttendance,
  getMyStatus,
  updateAttendance,
} from "../controllers/attendanceController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Attendance
 *     description: Endpoints for the Attendance CRUDs
 */

// ------------------------------------------------------------------------ //
// ------------------ Routes for all authenticated users ------------------ //
// ------------------------------------------------------------------------ //

// Check-in
/**
 * @swagger
 * /attendance/check-in:
 *   post:
 *     summary: Check in for today (All authenticated users)
 *     tags: 
 *       - Attendance
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [location]
 *             properties:
 *               location:
 *                 type: string
 *                 enum: [Remote, Onsite]
 *                 example: Remote
 *     responses:
 *       200:
 *         description: User Checked in successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attendance'
 *       401:
 *         description: Missing/Invalid token
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.post("/attendance/check-in", authenticate, checkIn);

// Check-out
/**
 * @swagger
 * /attendance/check-out:
 *   post:
 *     summary: Check out for today
 *     tags: 
 *       - Attendance
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User Checked out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attendance'
 *       401:
 *         description: Missing/Invalid token
 *       404:
 *         description: No attendance record found for today | User not found
 *       500:
 *         description: Server Error
 */
router.post("/attendance/check-out", authenticate, checkOut);

// Get the user's attendance status for today
/**
 * @swagger
 * /attendance/me:
 *   get:
 *     summary: Get the current user's attendance status for today
 *     tags: 
 *       - Attendance
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's attendance record for today
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attendance'
 *       401:
 *         description: Missing/Invalid token
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.get("/attendance/me", authenticate, getMyStatus);

// ------------------------------------------------------------------------ //
// ------------------ Routes for Admins and Supervisors ------------------- //
// ------------------------------------------------------------------------ // 

// Get attendance records (Admin/Supervisor)
/**
 * @swagger
 * /attendance:
 *   get:
 *     summary: Get attendance records (Admin/Supervisor)
 *     tags: 
 *       - Attendance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID (optional)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter (optional)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter (optional)
 *     responses:
 *       200:
 *         description: List of attendance records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                   example: 5
 *                 result:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Attendance'
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.get(
  "/attendance",
  authenticate,
  authorize(["Admin", "Supervisor"]),
  getAttendance
);

// Update attendance record (Admin only)
/**
 * @swagger
 * /attendance/{id}:
 *   patch:
 *     summary: update an attendance record (Admin only)
 *     tags: 
 *       - Attendance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Attendance record ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checkInTime:
 *                 type: string
 *                 example: "09:17 AM"
 *               checkOutTime:
 *                 type: string
 *                 example: "05:00 PM"
 *               status:
 *                 type: string
 *                 enum: [present, late, absent, leave]
 *                 example: present
 *               location:
 *                 type: string
 *                 enum: [Remote, Onsite]
 *                 example: Remote
 *               notes:
 *                 type: string
 *                 example: "Worked from home"
 *     responses:
 *       200:
 *         description: Attendance updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attendance'
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized 
 *       404:
 *         description: Attendance record not found
 *       500:
 *         description: Server Error
 */
router.patch(
  "/attendance/:id",
  authenticate,
  authorize(["Admin"]),
  updateAttendance
);

export default router;
