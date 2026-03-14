import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    format: {
      type: String,
      required: true,
      enum: ["PDF", "Word", "Excel", "JPEG", "PNG", "WEBP", "Other"],
    },
    size: {
      type: Number, // Size in bytes
      required: true,
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    fileURL: {
      // Cloudinary URL
      type: String,
      required: true,
    },
    filePublicId: {
      // Cloudinary public ID of each document used for deletion
      type: String,
      required: true,
    },
    fileHash: {
      // Hash of the file for integrity checks (Also prevents duplicate uploads)
      type: String,
      required: true,
    },
    isConfidential: {
      type: Boolean,
      default: false,
    },
    documentType_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DocumentType",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index to prevent duplicate uploads of the same file by the same user
documentSchema.index({ fileHash: 1, user_id: 1 }, { unique: true });

export default mongoose.model("Document", documentSchema);
