import express from "express";
import {
  getTimetableByUser,
  updateTimetableEntry,
  bulkUpdateTimetableEntries,
  deleteTimetableEntry,
} from "../controllers/timetableController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// All users can see their own timetable, Admins/Supervisors can see others'
router.get(
  "/timetable/:userId",
  authenticate,
  authorize(["Admin", "Supervisor"], { allowSelf: true }),
  getTimetableByUser
);

// Only Admin can modify timetables
router.put(
  "/timetable",
  authenticate,
  authorize(["Admin"]),
  updateTimetableEntry
);

// Bulk update timetable entries
router.put(
  "/timetable/bulk",
  authenticate,
  authorize(["Admin"]),
  bulkUpdateTimetableEntries
);

// Only Admin can delete timetable entries
router.delete(
  "/timetable",
  authenticate,
  authorize(["Admin"]),
  deleteTimetableEntry
);

export default router;
