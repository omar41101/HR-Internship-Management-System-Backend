import express from "express";
import {
  getTimetableByUser,
  addTimetableEntry,
  updateTimetableEntry,
  bulkUpdateTimetableEntries,
  deleteTimetableEntry,
  clearMonthTimetable,
} from "../controllers/timetableController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Timetable
 *     description: Endpoints for the Timetable (Shift Scheduling) CRUDs
 */ 

// All users can see their own timetable, Admin can see all timetables, Supervisor can see the timetable of the users they supervise
/**
 * @swagger
 * /timetable/{userId}:
 *   get:
 *     summary: Get a timetable for a specific user
 *     tags: 
 *        - Timetable
 *     description: Retrieve the timetable for a specific user. Admins and Supervisors can access any user's timetable, while regular users can only access their own.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *     responses:
 *       200:
 *         description: Timetable fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 result:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Timetable'
 *       400:
 *         description: Bad request (e.g., invalid userId format)
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
  "/timetable/:userId",
  authenticate,
  authorize(["Admin", "Supervisor"], { allowSelf: true }),
  getTimetableByUser
);

// Add a timetable entry (Admin Only)
router.post(
  "/timetable",
  authenticate,
  authorize(["Admin"]),
  addTimetableEntry
);

// Update a timetable entry (Admin Only)
/**
 * @swagger
 * /timetable:
 *   put:
 *     summary: Update or create a timetable entry
 *     tags: 
 *        - Timetable
 *     description: Update or create a timetable entry for a user (Admin only).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, date, type, location]
 *             properties:
 *               userId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *               type:
 *                 type: string
 *                 enum:
 *                   - Morning Shift
 *                   - Evening Shift
 *                   - Full-time Shift
 *                   - Day Off
 *                   - Special Shift
 *               location:
 *                 type: string
 *                 enum: [Remote, Onsite]
 *               color:
 *                 type: string
 *               duration:
 *                 type: string
 *     responses:
 *       200:
 *         description: Timetable entry updated successfully
 *       400: 
 *         description: Bad request (e.g., missing required fields, invalid userId format)
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized (only Admins can update timetable entries)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.put(
  "/timetable",
  authenticate,
  authorize(["Admin"]),
  updateTimetableEntry
);

// Bulk update timetable entries
/**
 * @swagger
 * /timetable/bulk:
 *   put:
 *     summary: Bulk update or create timetable entries
 *     tags: 
 *        - Timetable
 *     description: Bulk update or create multiple timetable entries at the same time for a user (Admin only).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, dates, type, location]
 *             properties:
 *               userId:
 *                 type: string
 *               dates:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: date-time
 *               type:
 *                 type: string
 *               location:
 *                 type: string
 *               color:
 *                 type: string
 *               duration:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bulk updated successfully
 *       400:
 *         description: Bad request (e.g., missing required fields, invalid userId format)
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized (only Admins can bulk update timetable entries)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.put(
  "/timetable/bulk",
  authenticate,
  authorize(["Admin"]),
  bulkUpdateTimetableEntries
);

// Only Admin can delete timetable entries
/**
 * @swagger
 * /timetable:
 *   delete:
 *     summary: Delete a timetable entry
 *     tags: 
 *        - Timetable
 *     description: Delete a specific timetable entry for a user (Admin only).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, date]
 *             properties:
 *               userId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Timetable entry deleted successfully
 *       400:
 *         description: Bad request (e.g., missing required fields, invalid userId format)
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized (only Admins can delete timetable entries)
 *       404:
 *         description: User or timetable entry not found
 *       500:
 *         description: Server Error
 */
router.delete(
  "/timetable",
  authenticate,
  authorize(["Admin"]),
  deleteTimetableEntry
);

/**
 * @swagger
 * /timetable/{userId}/{year}/{month}:
 *   delete:
 *     summary: Clear all timetable entries for a specific month
 *     tags: 
 *        - Timetable
 *     description: Permanently delete all shift records for a user within a target month (Admin or HR only).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: year
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: month
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Month cleared successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server Error
 */
router.delete(
  "/timetable/:userId/:year/:month",
  authenticate,
  authorize(["Admin"]),
  clearMonthTimetable
);

export default router;
