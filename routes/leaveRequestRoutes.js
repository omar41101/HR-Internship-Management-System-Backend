import express from "express";
import {
    getAllLeaveRequests,
    getLeaveRequestById,
    addLeaveRequest,
    updateLeaveRequest,
    cancelLeaveRequest,
    markLeaveRequestUnderReview,
    approveOrRejectLeaveRequest,
    getLeaveStatuses,
} from "../controllers/leaveRequestController.js";
import { upload } from "../middleware/upload.js";
import authenticate from "../middleware/authenticate.js";

const router = express.Router();

// Route to add a new leave request (Every authenticated user)
router.post("/leave-requests", authenticate, upload("doc").single("attachement"), addLeaveRequest); 

// Route to get leave request statuses based on user role (Every authenticated user)
router.get("/leave-statuses", authenticate, getLeaveStatuses);

// Route to get all leave requests with pagination (Every authenticated user)
router.get("/leave-requests", authenticate, getAllLeaveRequests);

// Route to get a leave request by ID
router.get("/leave-requests/:id", authenticate, getLeaveRequestById);

// Route to update a leave request (The user himself)
router.patch("/leave-requests/:id", authenticate, updateLeaveRequest);

// Route to cancel a leave request (The user himself)
router.delete("/leave-requests/:id", authenticate, cancelLeaveRequest);

// Route to mark a leave request as under review (Supervisor/Admin)
router.patch("/leave-requests/mark-under-review/:id", authenticate, markLeaveRequestUnderReview);

// Route to approve or reject a leave request (Supervisor/Admin)
router.patch("/leave-requests/approve-reject/:id", authenticate, approveOrRejectLeaveRequest);

export default router;
