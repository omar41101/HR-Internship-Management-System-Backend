import express from "express";
import { getSpecialShifts, createSpecialShift } from "../controllers/specialShiftController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// GET all reusable special shift types (Admin/HR only)
router.get(
  "/special-shifts",
  authenticate,
  authorize(["Admin", "HR"]),
  getSpecialShifts
);

// POST — create a new reusable special shift type (Admin/HR only)
router.post(
  "/special-shifts",
  authenticate,
  authorize(["Admin", "HR"]),
  createSpecialShift
);

export default router;
