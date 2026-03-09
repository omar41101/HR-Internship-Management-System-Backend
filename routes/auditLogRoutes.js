import express from "express";
import { getRecentAuditLogs, getAllAuditLogs } from "../controllers/auditLogController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Route to get the 5 most recent audit logs
// We'll protect and authorize this for Admin/HR only.
router.get("/audit-logs/recent", authenticate, authorize(["Admin"]), getRecentAuditLogs);

// Route to get all paginated audit logs
router.get("/audit-logs", authenticate, authorize(["Admin"]), getAllAuditLogs);

export default router;
