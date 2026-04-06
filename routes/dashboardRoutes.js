import express from "express";
import { getSupervisorDashboardStats } from "../controllers/dashboardController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

/**
 * @swagger
 * /api/v0/dashboard/supervisor:
 *   get:
 *     summary: Get supervisor dashboard statistics
 *     tags:
 *       - Dashboard
 *     description: Returns aggregated statistics for a supervisor's team dashboard.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics returned successfully
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized (Admin or Supervisor only)
 *       500:
 *         description: Server error
 */
router.get(
	"/supervisor",
	authenticate,
	authorize(["Admin", "Supervisor"]),
	getSupervisorDashboardStats
);

export default router;
