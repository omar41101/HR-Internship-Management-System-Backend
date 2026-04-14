import mongoose from "mongoose";

const auditLogSchema = mongoose.Schema(
  {
    admin_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "CREATE_USER",
        "UPDATE_USER",
        "DELETE_USER",
        "TOGGLE_STATUS",
        "CREATE_DEPARTMENT",
        "UPDATE_DEPARTMENT",
        "DELETE_DEPARTMENT",
        "CREATE_ROLE",
        "UPDATE_ROLE",
        "DELETE_ROLE",
        "UPLOAD_IMAGE",
        "REMOVE_IMAGE",
        "CREATE_LEAVE_TYPE",
        "UPDATE_LEAVE_TYPE",
        "ARCHIVE_LEAVE_TYPE",
        "RESTORE_LEAVE_TYPE",
        "MARK_LEAVE_REQUEST_UNDER_REVIEW",
        "APPROVE_LEAVE_REQUEST",
        "REJECT_LEAVE_REQUEST",
      ],
    },
    target_type: {
      type: String,
      required: true,
      enum: ["User", "Department", "UserRole", "LeaveType", "LeaveRequest"],
    },
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    target_name: {
      type: String, // Storing name for quick reference even if target is deleted
      required: false,
    },
    details: {
      type: mongoose.Schema.Types.Mixed, // For storing flexible change data
      default: {},
    },
    ipAddress: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only need creation time
  },
);

export default mongoose.model("AuditLog", auditLogSchema);
