import express from "express";
import {
  checkIn,
  checkOut,
  getAttendance,
  getMyStatus
} from "../controllers/attendanceController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Routes for all authenticated users
router.post("/attendance/check-in", authenticate, checkIn);
router.post("/attendance/check-out", authenticate, checkOut);
router.get("/attendance/me", authenticate, getMyStatus);

// Routes for Admins and Supervisors
router.get(
  "/attendance",
  authenticate,
  authorize(["Admin", "Supervisor"]),
  getAttendance
);

export default router;
