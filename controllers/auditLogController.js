import AuditLog from "../models/AuditLog.js";

/**
 * @desc    Helper to format audit logs for the frontend
 * @param   {Object} log - The raw lean AuditLog document 
 * @returns {Object} Formatted log object
 */
const formatAuditLog = (log) => {
    let description = "";

    // Format description based on action and target
    switch (log.action) {
        case "DELETE_USER":
            description = `Deleted User #${log.target_name}`;
            break;
        case "UPDATE_ROLE":
            description = `Updated Role Permissions for ${log.target_name || log.target_id}`;
            break;
        case "CREATE_USER":
            description = `Created ${log.target_name ? log.target_name + ' ' : ''}Account`;
            break;
        case "UPLOAD_IMAGE":
            description = `Uploaded Document/Image`;
            break;
        case "UPDATE_USER":
            description = `Updated User ${log.target_name || log.target_id}`;
            break;
        case "TOGGLE_STATUS":
            description = `Changed System Settings`;
            if (log.details && log.details.status) {
                description = `Changed User Status to ${log.details.status}`;
            }
            break;
        case "CREATE_DEPARTMENT":
            description = `Created Department ${log.target_name || log.target_id}`;
            break;
        case "UPDATE_DEPARTMENT":
            description = `Updated Department ${log.target_name || log.target_id}`;
            break;
        case "DELETE_DEPARTMENT":
            description = `Deleted Department ${log.target_name || log.target_id}`;
            break;
        case "CREATE_ROLE":
            description = `Created Role ${log.target_name || log.target_id}`;
            break;
        case "DELETE_ROLE":
            description = `Deleted Role ${log.target_name || log.target_id}`;
            break;
        default:
            description = `Performed ${log.action} on ${log.target_type}`;
    }

    // Also fallback description if provided explicitly in details
    if (log.details && log.details.description) {
        description = log.details.description;
    }

    return {
        _id: log._id,
        adminId: log.admin_id?._id,
        adminName: log.admin_id ? `${log.admin_id.name} ${log.admin_id.lastName || ''}`.trim() : "System",
        action: log.action,
        entityType: log.target_type,
        entityId: log.target_name || log.target_id,
        description: description,
        createdAt: log.createdAt,
    };
};

// @desc    Get recent audit logs
// @route   GET /api/audit-logs/recent
// @access  Private (Admin/HR)
export const getRecentAuditLogs = async (req, res, next) => {
    try {
        // Fetch the 5 most recent audit logs
        const logs = await AuditLog.find({})
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("admin_id", "name lastName email") // Populate admin details if needed
            .lean();

        // Format the output to match the frontend expected structure
        const formattedLogs = logs.map(formatAuditLog);

        res.status(200).json(formattedLogs);
    } catch (error) {
        next(error);
    }
};

// @desc    Get all audit logs with pagination and filters
// @route   GET /api/audit-logs
// @access  Private (Admin/HR)
export const getAllAuditLogs = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, admin, action, startDate, endDate } = req.query;
        const query = {};

        // Filter by specific Admin name/ID
        if (admin && admin.trim() !== "") {
            if (admin.match(/^[0-9a-fA-F]{24}$/)) {
                query.admin_id = admin;
            }
        }

        // Filter by Action Type
        if (action && action !== 'All Actions') {
            query.action = action;
        }

        // Date Range
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        // Search text (Action, Type, Details)
        if (search) {
            query.$or = [
                { action: { $regex: search, $options: "i" } },
                { target_name: { $regex: search, $options: "i" } },
                { target_type: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [logs, total] = await Promise.all([
            AuditLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate("admin_id", "name lastName email")
                .lean(),
            AuditLog.countDocuments(query)
        ]);

        // Format similarly to recent logs
        const formattedLogs = logs.map(formatAuditLog);

        res.status(200).json({
            logs: formattedLogs,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        next(error);
    }
};
