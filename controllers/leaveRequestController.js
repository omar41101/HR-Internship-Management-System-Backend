import LeaveRequest from "../models/LeaveRequest.js";
import LeaveType from "../models/LeaveType.js";
import User from "../models/User.js";
import { errors } from "../errors/leaveRequestErrors.js";
import { errors as tokenErrors } from "../errors/middlewareTokenErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors as userErrors } from "../errors/userErrors.js";
import { errors as meetingErrors } from "../errors/meetingErrors.js";
import { errors as leaveTypeErrors } from "../errors/leaveTypeErrors.js";
import AppError from "../utils/AppError.js";
import { getStatusesByRole } from "../utils/leaveStatusByRole.js";
import {
  uploadDocToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryHelper.js";
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
    throw new AppError(
      tokenErrors.UNAUTHORIZED.message,
      tokenErrors.UNAUTHORIZED.code,
      tokenErrors.UNAUTHORIZED.errorCode,
      tokenErrors.UNAUTHORIZED.suggestion,
    );
  }

  // THE OTHER FILTERS
  let filters = {};

  // Filter by the leave request type
  if (typeId) filters.typeId = typeId;

  // Filter by the leave request status
  if (status) {
    if (!allowedStatuses.includes(status)) {
      throw new AppError(
        errors.INVALID_STATUS_PER_ROLE.message,
        errors.INVALID_STATUS_PER_ROLE.code,
        errors.INVALID_STATUS_PER_ROLE.errorCode,
        errors.INVALID_STATUS_PER_ROLE.suggestion,
      );
    }
    filters.status = status;
  }

  // Filter by month and year (for the startDate and endDate)
  if (month || year) {
    if (!year) {
      throw new AppError(
        errors.YEAR_REQUIRED.message,
        errors.YEAR_REQUIRED.code,
        errors.YEAR_REQUIRED.errorCode,
        errors.YEAR_REQUIRED.suggestion,
      );
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
      code: 200,
      message: "List of Leave requests retrieved successfully!",
      data: leaveRequests,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(total / limit),
        limitPerPage: limit,
        totalLeaveRequests: total,
      }
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
      code: 200,
      message: "Leave request statuses retrieved successfully!",
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
      throw new AppError(
        errors.LEAVE_REQUEST_NOT_FOUND.message,
        errors.LEAVE_REQUEST_NOT_FOUND.code,
        errors.LEAVE_REQUEST_NOT_FOUND.errorCode,
        errors.LEAVE_REQUEST_NOT_FOUND.suggestion
      );
    }

    // Authorization check (how much access the user has to this leave request)
    if (user.role === "Employee" || user.role === "Intern") {
      if (leaveRequest.employeeId._id.toString() !== user.id.toString()) {
        throw new AppError(
          errors.UNAUTHORIZED_TO_VIEW_LEAVE_REQUEST.message,
          errors.UNAUTHORIZED_TO_VIEW_LEAVE_REQUEST.code,
          errors.UNAUTHORIZED_TO_VIEW_LEAVE_REQUEST.errorCode,
          errors.UNAUTHORIZED_TO_VIEW_LEAVE_REQUEST.suggestion
        );
      }
    } else if (user.role === "Supervisor") {
      const isOwnRequest = leaveRequest.employeeId._id.toString() === user.id.toString();
      const isAssignedToSupervisor =
        leaveRequest.supervisorId &&
        leaveRequest.supervisorId._id.toString() === user.id.toString();

      if (!isOwnRequest && !isAssignedToSupervisor) {
        throw new AppError(
          errors.UNAUTHORIZED_TO_VIEW_LEAVE_REQUEST.message,
          errors.UNAUTHORIZED_TO_VIEW_LEAVE_REQUEST.code,
          errors.UNAUTHORIZED_TO_VIEW_LEAVE_REQUEST.errorCode,
          errors.UNAUTHORIZED_TO_VIEW_LEAVE_REQUEST.suggestion
        );
      }
    } else if (user.role === "Admin") {
      // Admin can view any leave request
    } else {
      throw new AppError(
        tokenErrors.UNAUTHORIZED.message,
        tokenErrors.UNAUTHORIZED.code,
        tokenErrors.UNAUTHORIZED.errorCode,
        tokenErrors.UNAUTHORIZED.suggestion
      );
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Leave request retrieved successfully!",
      data: leaveRequest,
    });
  } catch (err) {
    next(err);
  }
};

// Add a new leave request (Every authenticated user)
export const addLeaveRequest = async (req, res, next) => {
  try {
    const user = req.user; // Get the user from the token
    const { typeId, startDate, endDate, reason } = req.body;
    let attachmentURL = "";
    let attachmentPublicId = "";

    // Fetch the user from the DB
    const dbUser = await User.findById(req.user.id);
    if (!dbUser) {
      throw new AppError(
        commonErrors.USER_NOT_FOUND.message,
        commonErrors.USER_NOT_FOUND.code,
        commonErrors.USER_NOT_FOUND.errorCode,
        commonErrors.USER_NOT_FOUND.suggestion,
      );
    }

    // Validate required fields
    if (!typeId || !startDate || !endDate) {
      throw new AppError(
        errors.MISSING_REQUIRED_FIELDS.message,
        errors.MISSING_REQUIRED_FIELDS.code,
        errors.MISSING_REQUIRED_FIELDS.errorCode,
        errors.MISSING_REQUIRED_FIELDS.suggestion,
      );
    }

    // Validate the leave type
    const leaveType = await LeaveType.findById(typeId);
    if (!leaveType || leaveType.status === "Archived") {
      throw new AppError(
        leaveTypeErrors.LEAVE_TYPE_NOT_FOUND.message,
        leaveTypeErrors.LEAVE_TYPE_NOT_FOUND.code,
        leaveTypeErrors.LEAVE_TYPE_NOT_FOUND.errorCode,
        leaveTypeErrors.LEAVE_TYPE_NOT_FOUND.suggestion,
      );
    }

    // Gender validation (In case of childbirth leaves)
    if (
      (leaveType.gender !== "Both" && leaveType.gender !== dbUser.gender) ||
      (leaveType.requiresChildBirth && !dbUser.hasChildren)
    ) {
      throw new AppError(
        errors.INELIGIBLE_FOR_LEAVE_TYPE.message,
        errors.INELIGIBLE_FOR_LEAVE_TYPE.code,
        errors.INELIGIBLE_FOR_LEAVE_TYPE.errorCode,
        errors.INELIGIBLE_FOR_LEAVE_TYPE.suggestion,
      );
    }

    // Validate the dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end)) {
      throw new AppError(
        errors.INVALID_DATE_FORMAT.message,
        errors.INVALID_DATE_FORMAT.code,
        errors.INVALID_DATE_FORMAT.errorCode,
        errors.INVALID_DATE_FORMAT.suggestion,
      );
    }
    if (end < start) {
      throw new AppError(
        errors.INVALID_DATE_FORMAT.message,
        errors.INVALID_DATE_FORMAT.code,
        errors.INVALID_DATE_FORMAT.errorCode,
        "End date cannot be before start date!",
      );
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
        errors.OVERLAPPING_LEAVE_REQUEST.message,
        errors.OVERLAPPING_LEAVE_REQUEST.code,
        errors.OVERLAPPING_LEAVE_REQUEST.errorCode,
        errors.OVERLAPPING_LEAVE_REQUEST.suggestion,
      );
    }

    // Calculate the duration in days
    const duration = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Ensure that the duration does not exceed the leave type's max days
    if (leaveType.maxDays && duration > leaveType.maxDays) {
      throw new AppError(
        `Maximum allowed days for ${leaveType.name} is ${leaveType.maxDays}`,
        errors.DURATION_EXCEEDS_ALLOWED.code,
        errors.DURATION_EXCEEDS_ALLOWED.errorCode,
        `Maximum allowed days for ${leaveType.name} is ${leaveType.maxDays}`,
      );
    }

    // Upload the attachment if it exists
    if (req.file) {
      const result = await uploadDocToCloudinary(
        req.file.buffer,
        req.file.originalname,
        "hrcom/leave_docs",
      );
      attachmentURL = result.secure_url;
      attachmentPublicId = result.public_id;
    }

    // Determine the leave request's initial status based on the user's role
    let supervisorId = null;
    let status;

    if (user.role === "Employee" || user.role === "Intern") {
      supervisorId = dbUser.supervisor_id;

      if (!supervisorId) {
        throw new AppError(
          userErrors.SUPERVISOR_NOT_FOUND.message,
          userErrors.SUPERVISOR_NOT_FOUND.code,
          userErrors.SUPERVISOR_NOT_FOUND.errorCode,
          userErrors.SUPERVISOR_NOT_FOUND.suggestion,
        );
      }

      status = "Pending Supervisor Approval";
    } else if (user.role === "Supervisor") {
      status = "Pending Admin Approval";
    } else {
      throw new AppError(
        errors.UNAUTHORIZED_TO_SUBMIT_LEAVE_REQUEST.message,
        errors.UNAUTHORIZED_TO_SUBMIT_LEAVE_REQUEST.code,
        errors.UNAUTHORIZED_TO_SUBMIT_LEAVE_REQUEST.errorCode,
        errors.UNAUTHORIZED_TO_SUBMIT_LEAVE_REQUEST.suggestion,
      );
    }

    const newLeaveRequest = await LeaveRequest.create({
      employeeId: user.id,
      supervisorId,
      typeId,
      startDate: start,
      endDate: end,
      reason,
      attachmentURL: attachmentURL || "",
      attachmentPublicId: attachmentPublicId || "",
      duration,
      status,
      reviewedBy: null,
    });

    res.status(201).json({
      status: "Success",
      code: 201,
      message: "Leave Request submitted successfully!",
      data: newLeaveRequest,
    });
  } catch (err) {
    next(err);
  }
};

// Update a leave request (while it's still pending approval): The user himself
export const updateLeaveRequest = async (req, res, next) => {
  try {
    const user = req.user; // Get the user from the token
    const { id } = req.params; // Get the leave request ID

    const { typeId, startDate, endDate, reason, removeAttachment } = req.body;

    // Check the leave request existence
    const leaveRequest = await LeaveRequest.findById(id);
    if (!leaveRequest) {
      throw new AppError(
        errors.LEAVE_REQUEST_NOT_FOUND.message,
        errors.LEAVE_REQUEST_NOT_FOUND.code,
        errors.LEAVE_REQUEST_NOT_FOUND.errorCode,
        errors.LEAVE_REQUEST_NOT_FOUND.suggestion,
      );
    }

    // Ensure user owns the leave request
    if (leaveRequest.employeeId.toString() !== user.id) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_UPDATE_LEAVE_REQUEST.message,
        errors.UNAUTHORIZED_TO_UPDATE_LEAVE_REQUEST.code,
        errors.UNAUTHORIZED_TO_UPDATE_LEAVE_REQUEST.errorCode,
        errors.UNAUTHORIZED_TO_UPDATE_LEAVE_REQUEST.suggestion,
      );
    }

    // Only update the leave request if it's still pending approval (either by supervisor or admin)
    const isEditable =
      leaveRequest.status === "Pending Supervisor Approval" ||
      (leaveRequest.status === "Pending Admin Approval" &&
        !leaveRequest.reviewedBy);

    if (!isEditable) {
      throw new AppError("You can no longer update this leave request!", 400);
    }

    // Validate the leave type (if updated)
    let updatedTypeId = leaveRequest.typeId;

    if (typeId) {
      const leaveType = await LeaveType.findById(typeId);
      if (!leaveType || leaveType.status === "Archived") {
        throw new AppError(
          leaveTypeErrors.LEAVE_TYPE_NOT_FOUND.message,
          leaveTypeErrors.LEAVE_TYPE_NOT_FOUND.code,
          leaveTypeErrors.LEAVE_TYPE_NOT_FOUND.errorCode,
          leaveTypeErrors.LEAVE_TYPE_NOT_FOUND.suggestion,
        );
      }
      updatedTypeId = typeId;
    }

    // Validate the dates (if updated)
    let start = leaveRequest.startDate;
    let end = leaveRequest.endDate;

    if (startDate) start = new Date(startDate);
    if (endDate) end = new Date(endDate);

    if (isNaN(start) || isNaN(end)) {
      throw new AppError(
        errors.INVALID_DATE_FORMAT.message,
        errors.INVALID_DATE_FORMAT.code,
        errors.INVALID_DATE_FORMAT.errorCode,
        errors.INVALID_DATE_FORMAT.suggestion
      );
    }

    if (end < start) {
      throw new AppError(
        errors.INVALID_DATE_FORMAT.message,
        errors.INVALID_DATE_FORMAT.code,
        errors.INVALID_DATE_FORMAT.errorCode,
        errors.INVALID_DATE_FORMAT.suggestion
      );
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
        errors.OVERLAPPING_LEAVE_REQUEST.message,
        errors.OVERLAPPING_LEAVE_REQUEST.code,
        errors.OVERLAPPING_LEAVE_REQUEST.errorCode,
        errors.OVERLAPPING_LEAVE_REQUEST.suggestion
      );
    }

    // Recalculate duration
    const duration = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Attachement handling (In case of deletion + new upload)

    // CASE 1: Upload new file
    if (req.file) {
      // Delete the old file from cloudinary if exists
      if (leaveRequest.attachmentPublicId) {
        await deleteFromCloudinary(leaveRequest.attachmentPublicId, "raw");
      }

      // Upload the new file to cloudinary
      const result = await uploadDocToCloudinary(
        req.file.buffer,
        req.file.originalname,
        "hrcom/leave_docs",
      );

      leaveRequest.attachmentURL = result.secure_url;
      leaveRequest.attachmentPublicId = result.public_id;
    }

    // CASE 2: Delete the attachment
    else if (removeAttachment === true) {
      if (leaveRequest.attachmentPublicId) {
        await deleteFromCloudinary(leaveRequest.attachmentPublicId, "raw");
      }

      leaveRequest.attachmentURL = "";
      leaveRequest.attachmentPublicId = "";
    }

    // Update the fields
    leaveRequest.typeId = updatedTypeId;
    leaveRequest.startDate = start;
    leaveRequest.endDate = end;
    leaveRequest.reason = reason ?? leaveRequest.reason;
    leaveRequest.duration = duration;

    await leaveRequest.save();

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Leave request updated successfully!",
      data: leaveRequest,
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
      throw new AppError(
        errors.LEAVE_REQUEST_NOT_FOUND.message,
        errors.LEAVE_REQUEST_NOT_FOUND.code,
        errors.LEAVE_REQUEST_NOT_FOUND.errorCode,
        errors.LEAVE_REQUEST_NOT_FOUND.suggestion
      );
    }

    // Check if the user is the owner of the leave request
    if (leaveRequest.employeeId.toString() !== user.id.toString()) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_CANCEL_LEAVE_REQUEST.message,
        errors.UNAUTHORIZED_TO_CANCEL_LEAVE_REQUEST.code,
        errors.UNAUTHORIZED_TO_CANCEL_LEAVE_REQUEST.errorCode,
        errors.UNAUTHORIZED_TO_CANCEL_LEAVE_REQUEST.suggestion
      );
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
    } else {
      throw new AppError(
        tokenErrors.UNAUTHORIZED.message,
        tokenErrors.UNAUTHORIZED.code,
        tokenErrors.UNAUTHORIZED.errorCode,
        tokenErrors.UNAUTHORIZED.suggestion
      );
    }

    if (!canCancel) {
      throw new AppError(
        errors.CANNOT_CANCEL_LEAVE_REQUEST.message,
        errors.CANNOT_CANCEL_LEAVE_REQUEST.code,
        errors.CANNOT_CANCEL_LEAVE_REQUEST.errorCode,
        errors.CANNOT_CANCEL_LEAVE_REQUEST.suggestion
      );
    }

    // Delete the attachment from cloudinary if exists
    if (leaveRequest.attachmentPublicId) {
      await deleteFromCloudinary(leaveRequest.attachmentPublicId, "raw");
    }

    // Delete the leave request
    await LeaveRequest.findByIdAndDelete(id);

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Leave request cancelled successfully!",
      data: leaveRequest,
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
        throw new AppError(
          errors.LEAVE_REQUEST_NOT_FOUND.message,
          errors.LEAVE_REQUEST_NOT_FOUND.code,
          errors.LEAVE_REQUEST_NOT_FOUND.errorCode,
          errors.LEAVE_REQUEST_NOT_FOUND.suggestion,
        );
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
        { returnDocument: "after" },
      );

      if (!leaveRequest) {
        throw new AppError(
          errors.LEAVE_REQUEST_NOT_FOUND.message,
          errors.LEAVE_REQUEST_NOT_FOUND.code,
          errors.LEAVE_REQUEST_NOT_FOUND.errorCode,
          errors.LEAVE_REQUEST_NOT_FOUND.suggestion
        );
      }

      // Log the action
      const employee = await User.findById(leaveRequest.employeeId);

      await logAuditAction({
        adminId: req.user.id,
        action: "MARK_LEAVE_REQUEST_UNDER_REVIEW",
        targetType: "LeaveRequest",
        targetId: leaveRequest._id,
        targetName: employee
          ? `${employee.name} ${employee.lastName}`
          : "Employee",
        details: {
          status: leaveRequest.status,
          typeId: leaveRequest.typeId,
          startDate: leaveRequest.startDate,
          endDate: leaveRequest.endDate,
        },
        ipAddress: req.ip,
      });
    } else {
      throw new AppError(
        tokenErrors.UNAUTHORIZED.message,
        tokenErrors.UNAUTHORIZED.code,
        tokenErrors.UNAUTHORIZED.errorCode,
        tokenErrors.UNAUTHORIZED.suggestion,
      );
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Leave request is now under review!",
      data: leaveRequest,
    });
  } catch (err) {
    next(err);
  }
};

// Approve or reject a leave request (Supervisor/Admin)
export const approveOrRejectLeaveRequest = async (req, res, next) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { action, comments } = req.body;

    if (!["approve", "reject"].includes(action)) {
      throw new AppError(
        meetingErrors.INVALID_RESPONSE_STATUS.message,
        meetingErrors.INVALID_RESPONSE_STATUS.code,
        meetingErrors.INVALID_RESPONSE_STATUS.errorCode,
        meetingErrors.INVALID_RESPONSE_STATUS.suggestion,
      );
    }

    let leaveRequest;

    // SUPERVISOR WORKFLOW
    if (user.role === "Supervisor") {
      leaveRequest = await LeaveRequest.findOne({
        _id: id,
        supervisorId: user.id,
        status: "Under Supervisor Review",
      });

      if (!leaveRequest) {
        throw new AppError(
          errors.LEAVE_REQUEST_NOT_FOUND.message,
          errors.LEAVE_REQUEST_NOT_FOUND.code,
          errors.LEAVE_REQUEST_NOT_FOUND.errorCode,
          errors.LEAVE_REQUEST_NOT_FOUND.suggestion,
        );
      }

      leaveRequest.status =
        action === "approve"
          ? "Pending Admin Approval"
          : "Rejected by Supervisor";

      leaveRequest.comments = comments || "";

      await leaveRequest.save();
    }

    // ADMIN WORKFLOW
    else if (user.role === "Admin") {
      leaveRequest = await LeaveRequest.findOne({
        _id: id,
        status: "Under Admin Review",
        reviewedBy: user.id,
      });

      if (!leaveRequest) {
        throw new AppError(
          errors.LEAVE_REQUEST_NOT_FOUND.message,
          errors.LEAVE_REQUEST_NOT_FOUND.code,
          errors.LEAVE_REQUEST_NOT_FOUND.errorCode,
          errors.LEAVE_REQUEST_NOT_FOUND.suggestion,
        );
      }

      // Fetch employee & leave type BEFORE updating
      const employee = await User.findById(leaveRequest.employeeId);
      const leaveType = await LeaveType.findById(leaveRequest.typeId);

      if (!employee) {
        throw new AppError(
          commonErrors.USER_NOT_FOUND.message,
          commonErrors.USER_NOT_FOUND.code,
          commonErrors.USER_NOT_FOUND.errorCode,
          commonErrors.USER_NOT_FOUND.suggestion,
        );
      }

      if (!leaveType) {
        throw new AppError(
          leaveTypeErrors.LEAVE_TYPE_NOT_FOUND.message,
          leaveTypeErrors.LEAVE_TYPE_NOT_FOUND.code,
          leaveTypeErrors.LEAVE_TYPE_NOT_FOUND.errorCode,
          leaveTypeErrors.LEAVE_TYPE_NOT_FOUND.suggestion,
        );
      }

      // APPROVE LOGIC
      if (action === "approve") {
        // Only deduct if required
        if (leaveType.deductFrom !== "none"){
          const balance = employee.leaveBalances.find(
            (b) => b.typeId.toString() === leaveType._id.toString(),
          );

          if (!balance) {
            throw new AppError(
              errors.LEAVE_BALANCE_NOT_FOUND.message,
              errors.LEAVE_BALANCE_NOT_FOUND.code,
              errors.LEAVE_BALANCE_NOT_FOUND.errorCode,
              errors.LEAVE_BALANCE_NOT_FOUND.suggestion,
            );
          }

          if (balance.remainingDays < leaveRequest.duration) {
            throw new AppError(
              errors.INSUFFICIENT_LEAVE_BALANCE.message,
              errors.INSUFFICIENT_LEAVE_BALANCE.code,
              errors.INSUFFICIENT_LEAVE_BALANCE.errorCode,
              errors.INSUFFICIENT_LEAVE_BALANCE.suggestion,
            );
          }

          balance.remainingDays -= leaveRequest.duration;
          await employee.save();
        }

        leaveRequest.status = "Approved";
      }

      // REJECT LOGIC
      else {
        leaveRequest.status = "Rejected by Admin";
      }

      leaveRequest.comments = comments || "";
      leaveRequest.reviewedAt = new Date();

      await leaveRequest.save();

      // AUDIT LOG
      await logAuditAction({
        adminId: user.id,
        action:
          action === "approve"
            ? "APPROVE_LEAVE_REQUEST"
            : "REJECT_LEAVE_REQUEST",
        targetType: "LeaveRequest",
        targetId: leaveRequest._id,
        targetName: `${employee.name} ${employee.lastName}`,
        details: {
          status: leaveRequest.status,
          leaveType: leaveType.name,
          duration: leaveRequest.duration,
          startDate: leaveRequest.startDate,
          endDate: leaveRequest.endDate,
        },
        ipAddress: req.ip,
      });
    } else {
      throw new AppError(
        tokenErrors.UNAUTHORIZED.message,
        tokenErrors.UNAUTHORIZED.code,
        tokenErrors.UNAUTHORIZED.errorCode,
        tokenErrors.UNAUTHORIZED.suggestion,
      );
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message: `Leave request ${action}d successfully!`,
      data: leaveRequest,
    });
  } catch (err) {
    next(err);
  }
};
