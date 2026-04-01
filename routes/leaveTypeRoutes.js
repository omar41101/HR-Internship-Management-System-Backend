import express from "express";
import {
  addLeaveType,
  updateLeaveType,
  archiveLeaveType,
  restoreLeaveType,
  getAllActiveLeaveTypes,
  getAllArchivedLeaveTypes,
} from "../controllers/leaveTypeController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const route = express.Router();

// Route to add a new Leave Type (Admin only)
route.post(
  "/leaveType", 
  authenticate, 
  authorize(["Admin"]), 
  addLeaveType
);

// Route to update a Leave Type (Admin only)
route.patch(
  "/leaveType/:id",
  authenticate,
  authorize(["Admin"]),
  updateLeaveType,
);

// Route to archive a Leave Type (Admin only)
route.patch(
  "/leaveType/archive/:id",
  authenticate,
  authorize(["Admin"]),
  archiveLeaveType
);

// Route to restore an archived Leave Type (Admin only)
route.patch(
  "/leaveType/restore/:id",
  authenticate,
  authorize(["Admin"]),
  restoreLeaveType
);

// Route to get all active Leave Types (All authenticated users for the leave requests form)
route.get(
  "/leaveTypes/active", 
  authenticate, 
  getAllActiveLeaveTypes
);

// Route to get all archived Leave Types (Admin only)
route.get(
  "/leaveTypes/archived", 
  authenticate, 
  authorize(["Admin"]), 
  getAllArchivedLeaveTypes
);

export default route;
