import Document from "../models/Document.js";
import User from "../models/User.js";
import DocumentType from "../models/DocumentType.js";
import AppError from "../utils/AppError.js";
import {
  uploadImageToCloudinary,
  uploadDocToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryHelper.js";
import crypto from "crypto";
import { DOC_MIME_TYPES } from "../middleware/upload.js";

// Upload Personal Document (User himself or Admin)
export const uploadPersonalDocument = async (req, res, next) => {
  try {
    // Get the doc's owner's ID
    const targetUserId = req.params.id;

    // Check if the target user exists
    const user = await User.findById(targetUserId);
    if (!user) throw new AppError("User not found!", 404);

    // Check Personal document type existence
    const personalType = await DocumentType.findOne({ name: "Personal" });
    if (!personalType)
      throw new AppError("Personal document type not found!", 404);

    // Check if a file is uploaded
    if (!req.file) throw new AppError("No file uploaded!", 400);

    let result;
    let format;

    // Decide if it's an image or a doc
    if (req.file.mimetype.startsWith("image/")) {
      result = await uploadImageToCloudinary(
        req.file.buffer,
        req.file.originalname,
        "hrcom/personal_docs/images",
      );
      format = req.file.mimetype.split("/")[1].toUpperCase() || "Other";
    } else {
      result = await uploadDocToCloudinary(
        req.file.buffer,
        req.file.originalname,
        "hrcom/personal_docs/docs",
      );
      format = DOC_MIME_TYPES[req.file.mimetype] || "Other";
    }

    // Generate the file hash
    const fileHash = crypto
      .createHash("sha256")
      .update(req.file.buffer)
      .digest("hex");

    // Save the document
    const document = await Document.create({
      title: req.body.title || req.file.originalname,
      format,
      size: req.file.size,
      fileURL: result.secure_url,
      filePublicId: result.public_id,
      documentType_id: personalType._id,
      user_id: targetUserId,
      fileHash,
    });

    res.status(201).json({
      status: "Success",
      message: "Personal document uploaded successfully!",
      document,
    });
  } catch (err) {
    next(err);
  }
};

// Delete Personal Document (User himself or Admin)
export const deletePersonalDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;

    // Check the document existance
    const document = await Document.findById(documentId);
    if (!document) throw new AppError("Document not found!", 404);

    // Check if it's a personal document
    const personalType = await DocumentType.findOne({ name: "Personal" });
    if (!personalType)
      throw new AppError("Personal document type not found!", 404);
    if (!document.documentType_id.equals(personalType._id)) {
      throw new AppError("This is not a personal document!", 403);
    }

    // Determine type: image or raw
    let type = "raw"; // Default type for documents
    const imageFormats = ["JPEG", "PNG", "WEBP"];
    if (imageFormats.includes(document.format)) {
      type = "image";
    }

    // Delete from Cloudinary
    if (document.filePublicId) {
      const result = await deleteFromCloudinary(document.filePublicId, type);
      console.log("[DELETE-PERSONAL-IMAGE] Cloudinary Deletion result:", result); // { result: "ok" } if successful deletion
    }

    // Remove from database
    await document.deleteOne();

    res.status(200).json({
      status: "Success",
      message: "Personal document deleted successfully!",
    });
  } catch (err) {
    next(err);
  }
};







// Download Personal Document (User himself or Admin)
export const downloadPersonalDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;

    // Check document existance
    const document = await Document.findById(documentId);
    if (!document) throw new AppError("Document not found!", 404);
    // Check if personalType
    const personalType = await DocumentType.findOne({ name: "Personal" });
    if (!personalType)
      throw new AppError("Personal document type not found!", 404);
    if (!document.documentType_id.equals(personalType._id)) {
      throw new AppError("This is not a personal document!", 403);
    }

    // Redirect to the file URL for download
    const downloadURL = document.fileURL.replace(
      "/upload/",
      "/upload/fl_attachment/",
    );
    res.redirect(downloadURL);
  } catch (err) {
    next(err);
  }
};

// Consult Personal Document: ADD THE IS CONFIDENTIAL DETAIL LATER
export const consultPersonalDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;

    // Check document existence
    const document = await Document.findById(documentId);
    if (!document) throw new AppError("Document not found!", 404);

    // Check Personal document type
    const personalType = await DocumentType.findOne({ name: "Personal" });
    if (!personalType)
      throw new AppError("Personal document type not found!", 404);

    if (!document.documentType_id.equals(personalType._id)) {
      throw new AppError("This is not a personal document!", 403);
    }

    // Authorization: Admin OR owner
    if (req.user.role !== "Admin" && !document.user_id.equals(req.user.id)) {
      throw new AppError(
        "You are not authorized to access this document!",
        403,
      );
    }

    // Open the file in the browser
    res.redirect(document.fileURL);
  } catch (err) {
    next(err);
  }
};

// Get all personal documents of a user (User himself or Admin) : TO RECTIFYYYY
export const getPersonalDocuments = async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    // Check Personal document type
    const personalType = await DocumentType.findOne({ name: "Personal" });
    if (!personalType)
      throw new AppError("Personal document type not found!", 404);
    // Authorization: Admin OR owner
    if (req.user.role !== "Admin" && targetUserId !== req.user.id) {
      throw new AppError(
        "You are not authorized to access these documents!",
        403,
      );
    }
    const documents = await Document.find({
      user_id: targetUserId,
      documentType_id: personalType._id,
    }).select("-filePublicId -fileHash"); // Exclude sensitive fields
    res.status(200).json({
      status: "Success",
      documents,
    });
  } catch (err) {
    next(err);
  }
};

// Get the non-confidential personal documents of a user (User himself or Admin or his supervisor): TO RECTIFFYYY
export const getNonConfidentialPersonalDocuments = async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    // Check Personal document type
    const personalType = await DocumentType.findOne({ name: "Personal" });
    if (!personalType)
      throw new AppError("Personal document type not found!", 404);
    // Authorization: Admin OR owner OR supervisor
    if (
      req.user.role !== "Admin" &&
      targetUserId !== req.user.id &&
      !req.user.supervisedEmployees.includes(targetUserId)
    ) {
      throw new AppError(
        "You are not authorized to access these documents!",
        403,
      );
    }
    const documents = await Document.find({
      user_id: targetUserId,
      documentType_id: personalType._id,
      isConfidential: false, // Only non-confidential documents
    }).select("-filePublicId -fileHash"); // Exclude sensitive fields
    res.status(200).json({
      status: "Success",
      documents,
    });
  } catch (err) {
    next(err);
  }
};
