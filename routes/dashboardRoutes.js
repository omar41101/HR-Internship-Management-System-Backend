import express from "express";
import { getSupervisorDashboardStats } from "../controllers/dashboardController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

/**
 * Route to fetch supervisor statistics for the team dashboard
 */
router.get("/supervisor", authenticate, authorize(["Admin", "Supervisor"]), getSupervisorDashboardStats);

export default router;
