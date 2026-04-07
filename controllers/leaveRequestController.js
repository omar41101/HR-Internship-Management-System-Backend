import LeaveRequest from "../models/LeaveRequest.js";
import LeaveType from "../models/LeaveType.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js"; 
import { getStatusesByRole } from "../utils/leaveStatusByRole.js";
import { uploadDocToCloudinary } from "../utils/cloudinaryHelper.js";
import { logAuditAction } from "../utils/logger.js";

// --------------------------------------------------------- //
// ------------------ HELPER FUNCTIONS --------------------- //
// --------------------------------------------------------- //
const buildLeaveRequestQuery = (user, queryParams) => {
  const { typeId, status, month, year } = queryParams;

  let roleFilter = {};
  const allowedStatuses = getStatusesByRole(user.role);
  const userId = user._id || user.id;

  // ROLE FILTER
  if (user.role === "Supervisor") {
    roleFilter = {
      $or: [
        {
          supervisorId: userId,
          status: { $in: allowedStatuses },
        },
        {
          employeeId: userId,
        },
      ],
    };
  } else if (user.role === "Admin") {
    roleFilter = {
      status: { $in: allowedStatuses },
    };
  } else if (user.role === "Employee" || user.role === "Intern") {
    roleFilter = {
      employeeId: userId,
    };
  } else {
    throw new AppError("Unauthorized!", 403);
  }

  // THE OTHER FILTERS
  let filters = {};

  // Filter by the leave request type 
  if (typeId) filters.typeId = typeId;

  // Filter by the leave request status
  if (status) {
    if (!allowedStatuses.includes(status)) {
      throw new AppError("Invalid status for your role!", 400);
    }
    filters.status = status;
  }
  
  // Filter by month and year (for the startDate and endDate)
  if (month || year) {
    if (!year) {
      throw new AppError("Year is required when filtering by month!", 400);
    }

    const parsedMonth = parseInt(month) - 1 || 0;
    const parsedYear = parseInt(year);

    const startDate = new Date(parsedYear, parsedMonth, 1);
    const endDate = new Date(parsedYear, parsedMonth + 1, 0, 23, 59, 59);

    filters.startDate = { $lte: endDate };
    filters.endDate = { $gte: startDate };
  }

  return {
    $and: [roleFilter, filters],
  };
};

// --------------------------------------------------------- //
// --------------- LEAVE REQUEST WORKFLOW ------------------ //
// --------------------------------------------------------- //

// Add a new leave request (Every authenticated user)
export const addLeaveRequest = async (req, res, next) => {
  try {
    const user = req.user; // Get the user from the token
    const { typeId, startDate, endDate, reason } = req.body;
    let attachmentURL = "";

    // Upload the attachment if it exists
    if (req.file) {
      const result = await uploadDocToCloudinary(req.file.buffer, req.file.originalname, "hrcom/leave_docs");
      attachmentURL = result.secure_url;
    }

    // Validate required fields
    if (!typeId || !startDate || !endDate) {
      throw new AppError("Missing required fields!", 400);
    }

    // Validate the leave type
    const leaveType = await LeaveType.findById(typeId);
    if (!leaveType || leaveType.status === "Archived") {
      throw new AppError("Invalid leave type!", 400);
    }

    // Validate the dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end)) {
      throw new AppError("Invalid date format!", 400);
    }
    if (end < start) {
      throw new AppError("End date cannot be before start date!", 400);
    }

    // Check overlapping leave requests
    const overlappingRequest = await LeaveRequest.findOne({
      employeeId: user._id,
      status: {
        $nin: ["Rejected by Supervisor", "Rejected by Admin"],
      },
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start },
        },
      ],
    });

    if (overlappingRequest) {
      throw new AppError(
        "You already have a leave request in this period!",
        400,
      );
    }

    // Calculate the duration in days
    const duration = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Fetch the user from the DB
    const dbUser = await User.findById(req.user.id);

    if (!dbUser) {
      throw new AppError("User not found!", 404);
    }
        
    // Determine the leave request's initial status based on the user's role
    let supervisorId = null;
    let status;

    if (user.role === "Employee" || user.role === "Intern") {
      supervisorId = dbUser.supervisor_id;

      if (!supervisorId) {
        throw new AppError("Supervisor not found!", 404);
      }

      status = "Pending Supervisor Approval";
    } else if (user.role === "Supervisor") {
      status = "Pending Admin Approval";
    } else {
      throw new AppError("Unauthorized to submit leave request!", 403);
    }

    const newLeaveRequest = await LeaveRequest.create({
      employeeId: user._id,
      supervisorId,
      typeId,
      startDate: start,
      endDate: end,
      reason,
      attachmentURL: attachmentURL || "",
      duration,
      status,
      reviewedBy: null,
    });

    res.status(201).json({
      status: "Success",
      message: "Leave Request submitted successfully!",
      result: newLeaveRequest,
    });
  } catch (err) {
    next(err);
  }
}; 

// Get All leave requests based on the user role (with pagination: 10 leave requests per page): Every authenticated user
export const getAllLeaveRequests = async (req, res, next) => {
  try {
    const user = req.user; // Get the user from the token
    const { page = 1, limit: queryLimit } = req.query;

    const limit = Math.min(parseInt(queryLimit) || 10, 9999);
    const parsedPage = parseInt(page);
    const skip = (parsedPage - 1) * limit;

    // Build the query to determine which leave requests to show based on the user's role
    const query = buildLeaveRequestQuery(user, req.query);

    // Count the total leave requests (for pagination)
    const total = await LeaveRequest.countDocuments(query);

    // Fetch the paginated leave requests
    const leaveRequests = await LeaveRequest.find(query)
      .populate("employeeId", "name email")
      .populate("supervisorId", "name email")
      .populate("typeId", "name isPaid")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      status: "Success",
      page: parsedPage,
      totalPages: Math.ceil(total / limit),
      totalLeaveRequests: total,
      totalLeaveRequestsPerPage: leaveRequests.length,
      data: leaveRequests,
    });
  } catch (err) {
    next(err);
  }
}; 

// Get leave statuses based on the user role
export const getLeaveStatuses = (req, res, next) => {
  try {
    const user = req.user;

    const statuses = getStatusesByRole(user.role);

    res.status(200).json({
      status: "Success",
      data: statuses,
    });
  } catch (err) {
    next(err);
  }
};

// Get a leave request by ID (Every authenticated user)
export const getLeaveRequestById = async (req, res, next) => {
  try {
    const user = req.user; // Get the user from the token
    const { id } = req.params; // Get the leave request ID

    // Get the leave request
    const leaveRequest = await LeaveRequest.findById(id)
      .populate("employeeId", "name email")
      .populate("supervisorId", "name email")
      .populate("typeId", "name isPaid");

    if (!leaveRequest) {
      throw new AppError("Leave request not found!", 404);
    }

    // Authorization check (how much access the user has to this leave request)
    if (user.role === "Employee" || user.role === "Intern") {
      if (leaveRequest.employeeId._id.toString() !== user.id) {
        throw new AppError("Unauthorized!", 403);
      }
    } else if (user.role === "Supervisor") {
      const isOwnRequest = leaveRequest.employeeId._id.toString() === user._id;
      const isAssignedToSupervisor =
        leaveRequest.supervisorId &&
        leaveRequest.supervisorId._id.toString() === user._id;

      if (!isOwnRequest && !isAssignedToSupervisor) {
        throw new AppError("Unauthorized!", 403);
      }
    } else if (user.role === "Admin") {
      // Admin can view any leave request
    } else {
      throw new AppError("Unauthorized!", 403);
    }

    res.status(200).json({
      status: "Success",
      result: leaveRequest,
    });
  } catch (err) {
    next(err);
  }
};

// Update a leave request (while it's still pending approval): The user himself
export const updateLeaveRequest = async (req, res, next) => {
  try {
    const user = req.user;     // Get the user from the token
    const { id } = req.params; // Get the leave request ID

    const { typeId, startDate, endDate, reason, attachmentURL } = req.body;

    // Check the leave request existence
    const leaveRequest = await LeaveRequest.findById(id);
    if (!leaveRequest) {
      throw new AppError("Leave request not found!", 404);
    }

    // Ensure user owns the leave request
    if (leaveRequest.employeeId.toString() !== user.id) {
      throw new AppError("You can only update your own leave requests!", 403);
    }

    // Only update the leave request if it's still pending approval (either by supervisor or admin)
    const isEditable =
      leaveRequest.status === "Pending Supervisor Approval" ||
      (
        leaveRequest.status === "Pending Admin Approval" &&
        !leaveRequest.reviewedBy
      );

    if (!isEditable) {
      throw new AppError("You can no longer update this leave request!", 400);
    }

    // Validate the leave type (if updated)
    let updatedTypeId = leaveRequest.typeId;

    if (typeId) {
      const leaveType = await LeaveType.findById(typeId);
      if (!leaveType || leaveType.status === "Archived") {
        throw new AppError("Invalid leave type!", 400);
      }
      updatedTypeId = typeId;
    }

    // Validate the dates (if updated)
    let start = leaveRequest.startDate;
    let end = leaveRequest.endDate;

    if (startDate) start = new Date(startDate);
    if (endDate) end = new Date(endDate);

    if (isNaN(start) || isNaN(end)) {
      throw new AppError("Invalid date format!", 400);
    }

    if (end < start) {
      throw new AppError("End date cannot be before start date!", 400);
    }

    // Check overlapping leave requests (excluding the current request)
    const overlappingRequest = await LeaveRequest.findOne({
      _id: { $ne: id },
      employeeId: user._id,
      status: {
        $nin: ["Rejected by Supervisor", "Rejected by Admin"],
      },
      startDate: { $lte: end },
      endDate: { $gte: start },
    });

    if (overlappingRequest) {
      throw new AppError(
        "You already have a leave request in this period!",
        400
      );
    }

    // Recalculate duration
    const duration =
      Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

    
    // Update the fields
    leaveRequest.typeId = updatedTypeId;
    leaveRequest.startDate = start;
    leaveRequest.endDate = end;
    leaveRequest.reason = reason ?? leaveRequest.reason;
    leaveRequest.attachmentURL = attachmentURL ?? leaveRequest.attachmentURL;
    leaveRequest.duration = duration;

    await leaveRequest.save();

    res.status(200).json({
      status: "Success",
      message: "Leave request updated successfully!",
      result: leaveRequest,
    });
  } catch (err) {
    next(err);
  }
};

// Cancel a leave request (while it's still pending approval): The user himself
export const cancelLeaveRequest = async (req, res, next) => {
  try {
    const user = req.user; // Get the user from the token
    const { id } = req.params; // Get the leave request ID

    // Check the leave request existence
    const leaveRequest = await LeaveRequest.findById(id);
    if (!leaveRequest) {
      throw new AppError("Leave request not found!", 404);
    }

    // Check if the user is the owner of the leave request
    if (leaveRequest.employeeId.toString() !== user.id) {
      throw new AppError("You can only cancel your own leave requests!", 403);
    }

    // Determine if the leave request can be cancelled based on its status
    let canCancel = false;

    // Case 1: For an Employee / Intern
    if (user.role === "Employee" || user.role === "Intern") {
      canCancel = leaveRequest.status === "Pending Supervisor Approval";
    }
    // Case 2: For a Supervisor
    else if (user.role === "Supervisor") {
      canCancel =
        leaveRequest.status === "Pending Admin Approval" &&
        !leaveRequest.reviewedBy;
    }
    else {
      throw new AppError("Unauthorized!", 403);
    }

    if (!canCancel) {
      throw new AppError(
        "Cannot cancel this leave request anymore!",
        400
      );
    }

    // Delete the leave request
    await LeaveRequest.findByIdAndDelete(id);

    res.status(200).json({
      status: "Success",
      message: "Leave request cancelled successfully!",
      result: leaveRequest,
    });
  } catch (err) {
    next(err);
  }
};

// Mark a leave request as reviewed
export const markLeaveRequestUnderReview = async (req, res, next) => {
  try {
    const user = req.user; // Get the user from the token
    const { id } = req.params; // Get the leave request ID
    
    let leaveRequest;

    // SUPERVISOR FLOW
    if (user.role === "Supervisor") {
      leaveRequest = await LeaveRequest.findOne({
        _id: id,
        status: "Pending Supervisor Approval",
        supervisorId: user.id,
      });

      if (!leaveRequest) {
        throw new AppError("Leave request not found!", 404);
      }

      // Update the status to "Under Supervisor Review" 
      leaveRequest.status = "Under Supervisor Review";
      await leaveRequest.save();
    }

    // ADMIN FLOW
    else if (user.role === "Admin") {
      leaveRequest = await LeaveRequest.findOneAndUpdate(
        {
          _id: id,
          status: "Pending Admin Approval",
          reviewedBy: null,
        },
        {
          status: "Under Admin Review",
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
        { returnDocument: 'after' },
      );

      if (!leaveRequest) {
        throw new AppError("Leave request unavailable!", 404);
      }

      // Log the action
      await logAuditAction({
        adminId: req.user.id,
        action: "MARK_LEAVE_REQUEST_UNDER_REVIEW",
        targetType: "LeaveRequest",
        targetId: leaveRequest._id,
        targetName: leaveRequest.reason,
        details: {
          status: leaveRequest.status,
          typeId: leaveRequest.typeId,
          startDate: leaveRequest.startDate,
          endDate: leaveRequest.endDate,
        },
        ipAddress: req.ip,
      });
    } 
    
    else {
      throw new AppError("Unauthorized!", 403);
    }

    res.status(200).json({
      status: "Success",
      message: "Leave request is now under review!",
      result: leaveRequest,
    });
  } catch (err) {
    next(err);
  }
};

// Approve or reject a leave request (Supervisor/Admin)
export const approveOrRejectLeaveRequest = async (req, res, next) => {
  try {
    const user = req.user; // Get the user from the token
    const { id } = req.params; // Get the leave request ID
    const { action, comments } = req.body; // action = "approve" or "reject"

    if (!["approve", "reject"].includes(action)) {
      throw new AppError("Action must be 'approve' or 'reject'", 400);
    }

    let leaveRequest;

    // Supervisor workflow (Approve/Reject)
    if (user.role === "Supervisor") {
      leaveRequest = await LeaveRequest.findOne({
        _id: id,
        supervisorId: user._id,
        status: "Under Supervisor Review",
      });

      if (!leaveRequest) {
        throw new AppError(
          "Leave request not found!",
          404,
        );
      }

      leaveRequest.status =
        action === "approve"
          ? "Pending Admin Approval"
          : "Rejected by Supervisor";
      leaveRequest.comments = comments || "";

      await leaveRequest.save();
    }

    // Admin workflow in Approve/Reject
    else if (user.role === "Admin") {
      leaveRequest = await LeaveRequest.findOneAndUpdate(
        {
          _id: id,
          status: "Under Admin Review",
          reviewedBy: user._id,
        },
        {
          status: action === "approve" ? "Approved" : "Rejected by Admin",
          comments: comments || "",
          reviewedAt: new Date(),
        },
        { returnDocument: 'after' },
      );

      if (!leaveRequest) {
        throw new AppError(
          "Leave request not found!",
          404,
        );
      }

      // Update the user's leave balance if approved
      if (action === "approve") {
        const employee = await User.findById(leaveRequest.employeeId);
        if (employee) {
          employee.leaveBalance -= leaveRequest.duration;
          await employee.save();
        }

        // Log the action
        await logAuditAction({
          adminId: req.user.id,
          action: "APPROVE_LEAVE_REQUEST",
          targetType: "LeaveRequest",
          targetId: leaveRequest._id,
          targetName: leaveRequest.reason,
          details: {
            status: leaveRequest.status,
            typeId: leaveRequest.typeId,
            startDate: leaveRequest.startDate,
            endDate: leaveRequest.endDate,
          },
          ipAddress: req.ip,
        });
      }
      else {
        // Log the reject action
        await logAuditAction({
          adminId: req.user.id,
          action: "REJECT_LEAVE_REQUEST",
          targetType: "LeaveRequest",
          targetId: leaveRequest._id,
          targetName: leaveRequest.reason,
          details: {  
            status: leaveRequest.status,
            typeId: leaveRequest.typeId,
            startDate: leaveRequest.startDate,
            endDate: leaveRequest.endDate,
          },
          ipAddress: req.ip,
        });
      }
    } 
    
    else {
      throw new AppError("Unauthorized!", 403);
    }

    res.status(200).json({
      status: "Success",
      message: `Leave request ${action}d successfully!`,
      result: leaveRequest,
    });
  } catch (err) {
    next(err);
  }
};
