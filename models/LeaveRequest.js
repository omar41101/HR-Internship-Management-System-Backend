import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema(
  {
    employeeId: {
      // Represents the employee who is requesting the leave
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approverId: {
      // Represents the supervisor or admin who will approve/reject the leave request
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    typeId: {
      // Represents the type of leave being requested
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveType",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    reason: {
      // Represents the employee's reason for the leave request
      type: String,
    },
    status: {
      type: String,
      enum: [
        "Pending Supervisor Approval",
        "Rejected by Supervisor",
        "Pending Admin Approval",
        "Rejected by Admin",
        "Approved",
      ],
      default: "Pending Supervisor Approval",
    },
    comments: {
      // Represents any comments from the approver regarding the leave request
      type: String,
    },
    attachmentURL: {
      type: String,
    },
    duration: {
      // Represents the total number of days for the leave request (automatically calculated)
      type: Number,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("LeaveRequest", leaveRequestSchema);
