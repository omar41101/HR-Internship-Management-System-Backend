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
import cloudinary from "../config/cloudinary.js";

// ---------------------------------------------------------------------------- //
// ----------------------------- HELPER FUNCTIONS ----------------------------- //
// ---------------------------------------------------------------------------- //

// Check the existence of Personal document type
const checkPersonalTypeExistence = async () => {
  const personalType = await DocumentType.findOne({ name: "Personal" });
  if (!personalType) {
    throw new AppError("Personal document type not found!", 404);
  }

  return personalType;
};

// Check the document existence and if a document is a personal document
const isPersonalDocument = async (documentId) => {
  const personalType = await checkPersonalTypeExistence();

  const document = await Document.findById(documentId);
  if (!document) throw new AppError("Document not found!", 404);

  if (!document.documentType_id.equals(personalType._id)) {
    throw new AppError("This is not a personal document!", 404);
  }
  return document;
};

// ---------------------------------------------------------------------------- //
// --------------------- PERSONAL DOCUMENTS MANAGEMENT ------------------------ //
// ---------------------------------------------------------------------------- //

// Upload Personal Document (User himself or Admin)
export const uploadPersonalDocument = async (req, res, next) => {
  try {
    // Get the doc's owner's ID
    const targetUserId = req.params.id;

    // Get the isConfidential flag
    const isConfidential = req.body.isConfidential === "true";

    // Check if the target user exists
    const user = await User.findById(targetUserId);
    if (!user) throw new AppError("User not found!", 404);

    // Get the personal document type
    const personalType = await checkPersonalTypeExistence();

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
      isConfidential,
    });

    res.status(201).json({
      status: "Success",
      message: "Personal document uploaded successfully!",
      document,
    });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern && err.keyPattern.fileHash) {
      return next(new AppError("You have already uploaded this exact document.", 400));
    }
    next(err);
  }
};

// Delete Personal Document (User himself or Admin)
export const deletePersonalDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;

    // Get the document after its validation
    const document = await isPersonalDocument(documentId);

    // Determine type: image or raw
    let type = "raw"; // Default type for documents
    const imageFormats = ["JPEG", "PNG", "WEBP"];
    if (imageFormats.includes(document.format)) {
      type = "image";
    }

    // Delete from Cloudinary
    if (document.filePublicId) {
      const result = await deleteFromCloudinary(document.filePublicId, type);
      console.log(
        "[DELETE-PERSONAL-IMAGE] Cloudinary Deletion result:",
        result,
      ); // { result: "ok" } if successful deletion
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

// Download Personal Document (User himself or Admin or the user's supervisor)
export const downloadPersonalDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;

    // Get the document after its validation
    const document = await isPersonalDocument(documentId);

    // Strip any existing extension from title for a clean filename
    const baseTitle = document.title.replace(/\.[^/.]+$/, "");

    // Safely URL-encode the attachment filename so spaces become %20
    const safeAttachmentName = encodeURIComponent(baseTitle);

    // For raw files with spaces, the public_id itself must be encoded 
    // before signing, otherwise the signature will fail when the browser encodes it.
    const safePublicId = document.filePublicId.replace(/ /g, "%20");

    // Use the official Cloudinary SDK to build a cryptographically signed URL.
    const downloadUrl = cloudinary.url(safePublicId, {
      resource_type: "raw",            // Critical for PDFs/Docs
      flags: `attachment:${safeAttachmentName}`,
      sign_url: true                   // Appends the s-- Signature
    });

    // Redirect the client directly to Cloudinary — no proxying needed.
    return res.redirect(302, downloadUrl);
  } catch (err) {
    next(err);
  }
};

// Consult Personal Document (User himself or Admin or the user's supervisor)
export const consultPersonalDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;

    // Check document existence
    const document = await isPersonalDocument(documentId);

    // The raw fileURL generated by Cloudinary already serves PDFs with
    // Content-Type: application/pdf and images natively. 
    // Injecting fl_inline causes an "Invalid transformation" 400 error for raw files.
    const viewUrl = document.fileURL;

    res.status(200).json({
      status: "Success",
      url: viewUrl,
    });
  } catch (err) {
    next(err);
  }
};

// Get all personal documents of a user including the confidential docs (User himself or Admin)
export const getAllPersonalDocuments = async (req, res, next) => {
  try {
    // Get the Owner of docs's Id
    const targetUserId = req.params.id;

    // Check the user's existance
    const user = await User.findById(targetUserId);
    if (!user) throw new AppError("User not found!", 404);

    // Get the Personal document type object
    const personalType = await checkPersonalTypeExistence();

    // Get the list of documents
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

// Get the non-confidential personal documents of a user (User himself or Admin or his supervisor)
export const getNonConfidentialPersonalDocuments = async (req, res, next) => {
  try {
    // Get the owner Id
    const targetUserId = req.params.id;

    // Check the user's existance
    const user = await User.findById(targetUserId);
    if (!user) throw new AppError("User not found!", 404);

    // Get the Personal document type object
    const personalType = await checkPersonalTypeExistence();

    // Get the list of non-confidential documents
    const documents = await Document.find({
      user_id: targetUserId,
      documentType_id: personalType._id,
      isConfidential: false,
    }).select("-filePublicId -fileHash"); // Exclude sensitive fields

    res.status(200).json({
      status: "Success",
      documents,
    });
  } catch (err) {
    next(err);
  }
};

// Toggle Document Confidentiality (True/False) (User himself or Admin)
export const toggleConfidentiality = async (req, res, next) => {
  try {
    // Get the document Id
    const { id } = req.params;

    // Get the document after its validation
    const document = await isPersonalDocument(id);

    // Toggle the document's confidentiality
    document.isConfidential = document.isConfidential === true ? false : true;
    await document.save();

    res.status(200).json({
      status: "Success",
      message: `Document confidentiality has been toggled successfully!`,
      data: { id: document._id, isConfidential: document.isConfidential },
    });
  } catch (err) {
    next(err);
  }
};
