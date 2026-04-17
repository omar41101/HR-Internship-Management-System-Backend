// Core document service functions that can be used across different document types (personal, company, etc.)
import Document from "../models/Document.js";
import { pipeline } from "stream/promises";
import fetch from "node-fetch";
import {
  uploadImageToCloudinary,
  uploadDocToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryHelper.js";
import { DOC_MIME_TYPES } from "../middleware/upload.js";
import { getOne, getAll } from "./handlersFactory.js";

// Upload a document (image or document) to Cloudinary
export const uploadDocumentCore = async (file, folderImage, folderDoc) => {
  let result;
  let format;

  // Upload an image to cloudinary
  if (file.mimetype.startsWith("image/")) {
    result = await uploadImageToCloudinary(
      file.buffer,
      file.originalname,
      folderImage,
    );
    format = file.mimetype.split("/")[1].toUpperCase();
  } else {
    // Upload a document to cloudinary
    result = await uploadDocToCloudinary(
      file.buffer,
      file.originalname,
      folderDoc,
    );
    format = DOC_MIME_TYPES[file.mimetype] || "Other";
  }

  return {
    fileURL: result.secure_url,
    filePublicId: result.public_id,
    format,
    size: file.size,
  };
};

// Delete a document from Cloudinary
export const deleteDocumentCore = async (document) => {
  let type = "raw";
  const imageFormats = ["JPEG", "PNG", "WEBP"];

  if (imageFormats.includes(document.format)) {
    type = "image";
  }

  if (document.filePublicId) {
    const result = await deleteFromCloudinary(document.filePublicId, type);
    console.log("[DELETE-PERSONAL-IMAGE] Cloudinary Deletion result:", result);
  }

  await document.deleteOne();
};

// Download a document from Cloudinary
export const downloadDocumentCore = async (document, res) => {
  const extMap = {
    PDF: "pdf",
    Word: "docx",
    Excel: "xlsx",
    JPEG: "jpeg",
    PNG: "png",
    WEBP: "webp",
    Other: "bin",
  };

  const baseTitle = document.title.replace(/\.[^/.]+$/, "");
  const ext = extMap[document.format] || "bin";
  const fileName = `${baseTitle}.${ext}`;

  const response = await fetch(document.fileURL);
  if (!response.ok) throw new AppError("Failed to fetch document", 500);

  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader(
    "Content-Type",
    response.headers.get("content-type") || "application/octet-stream",
  );

  await pipeline(response.body, res);
};

// Consult a document (Get the document URL for viewing): STILL NOT TESTED
export const consultDocumentCore = (document) => {
  return {
    status: "Success",
    code: 200,
    message: "Personal document URL retrieved successfully!",
    data: {
      url: document.fileURL,
    },
  };
};

// Get all documents (Generic)
export const getDocumentsCore = getAll(Document, null, "-filePublicId -__v", ["title"]);
