import User from "../models/User.js";
import Document from "../models/Document.js";
import DocumentType from "../models/DocumentType.js";
import AppError from "../utils/AppError.js";
import { errors } from "../errors/documentErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors as documentTypeErrors } from "../errors/documentTypeErrors.js";
import crypto from "crypto";
import { 
  uploadDocumentCore, 
  deleteDocumentCore, 
  downloadDocumentCore, 
  consultDocumentCore, 
  getDocumentsCore 
} from "./documentCoreService.js";
import { validatePersonalDocument } from "../validators/documentValidators.js";
import { 
  getPersonalType, 
  getValidPersonalDocument, 
  getValidAdminDocument 
} from "../utils/documentHelper.js";

// ---------------------------------------------------------------------- //
// -------------------- PERSONAL DOCUMENTS SERVICES --------------------- //
// ---------------------------------------------------------------------- //

// Upload a personal document service
export const uploadPersonalDocumentService = async ({
  targetUserId,
  uploaderId,
  file,
  title,
  isConfidential,
}) => {
  // Check if a file is uploaded
  if (!file) {
    throw new AppError(
      commonErrors.NO_FILE_UPLOADED.message,
      commonErrors.NO_FILE_UPLOADED.code,
      commonErrors.NO_FILE_UPLOADED.errorCode,
      commonErrors.NO_FILE_UPLOADED.suggestion,
    );
  }

  // Check the user existence
  const user = await User.findById(targetUserId);
  if (!user) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Get the Personal document type
  const personalType = await getPersonalType();

  // Compute the file hash for duplicate detection
  const fileHash = crypto
    .createHash("sha256")
    .update(file.buffer)
    .digest("hex");

  // Check for duplicate file for the same user and document type
  const existingDoc = await Document.findOne({ fileHash });
  if (existingDoc) {
    throw new AppError(
      errors.DUPLICATE_FILE.message,
      errors.DUPLICATE_FILE.code,
      errors.DUPLICATE_FILE.errorCode,
      errors.DUPLICATE_FILE.suggestion,
    );
  }

  // Upload the document to Cloudinary
  const fileData = await uploadDocumentCore(
    file,
    "hrcom/personal_docs/images",
    "hrcom/personal_docs/docs",
  );

  // DB Document creation
  const document = await Document.create({
    title: title || file.originalname,
    ...fileData,
    fileHash,
    documentType_id: personalType._id,
    user_id: targetUserId,
    uploadedBy: uploaderId,
    isConfidential,
  });

  return {
    status: "Success",
    code: 201,
    message: "Personal document uploaded successfully!",
    data: document,
  };
};

// Delete a personal document service
export const deletePersonalDocumentService = async ({ documentId }) => {
  // Validate the document existence and type
  const document = await getValidPersonalDocument(documentId);

  // Delete the document from Cloudinary and DB
  await deleteDocumentCore(document);

  return {
    status: "Success",
    code: 200,
    message: "Personal document deleted successfully!",
  };
};

// Download a personal document service
export const downloadPersonalDocumentService = async ({ documentId, res }) => {
  // Validate the document existence and type
  const document = await getValidPersonalDocument(documentId);

  await downloadDocumentCore(document, res);

  return {
    status: "Success",
    code: 200,
    message: "Personal document downloaded successfully!",
  };
};

// Consult a personal document service
export const consultPersonalDocumentService = async ({ documentId }) => {
  // Validate the document existence and type
  const document = await getValidPersonalDocument(documentId);

  return await consultDocumentCore(document);
};

// Get all personal documents for a user (Filter: Confidentiality, Pagination)
export const getPersonalDocumentsService = async ({
  userId,
  queryParams,
  requester // To check if we allow seeing the confidential documents or not
}) => {
  const personalType = await getPersonalType();

  // Convert isConfidential query param to boolean for the filter to work correctly
  let parsedQuery = { ...queryParams };
  if (parsedQuery.isConfidential !== undefined) {
    parsedQuery.isConfidential = parsedQuery.isConfidential === "true";
  }

  // Access Control
  const isOwner = requester.id === userId;
  const isAdmin = requester.role === "Admin";

  if (!isOwner && !isAdmin) {
    // Force that only non-confidential documents are retrieved for non-owners and non-admins
    parsedQuery.isConfidential = false;
  }

  const finalQuery = {
    ...parsedQuery,
    user_id: userId,
    documentType_id: personalType._id,
    limit: 5,
    sort: "-createdAt", 
  };

  return getDocumentsCore(finalQuery);
};

// Toggle the personal document confidentiality: STILL NOT TESTED
export const toggleConfidentialityService = async ({ documentId }) => {
  // Validate the document existence and type
  const document = await getValidPersonalDocument(documentId);

  // Toggle the confidentiality status
  document.isConfidential = !document.isConfidential;
  await document.save();

  return {
    status: "Success",
    code: 200,
    message: "Personal document confidentiality toggled successfully!",
    data: document,
  };
};

// ---------------------------------------------------------------------- //
// ----------------- ADMINISTRATIVE DOCUMENTS SERVICES ------------------ //
// ---------------------------------------------------------------------- //

// Get all administrative documents
export const getAdminDocumentsService = async ({ queryParams }) => {
  const parsedQuery = { ...queryParams };

  // Get the personal document type object to exclude it later
  const personalType = await getPersonalType();

  // Support type=DocumentTypeName for filtering instead of documentType_id
  if (parsedQuery.type) {
    // Look for the corresponding document type ID based on the provided type name
    const type = await DocumentType.findOne({ name: parsedQuery.type });
    if (!type) {
      throw new AppError(
        documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.message,
        documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.code,
        documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.errorCode,
        documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.suggestion,
      );
    }

    // If the type is not Personal, we proceed with the filtering
    if (type._id.toString() !== personalType._id.toString()) {
      parsedQuery.documentType_id = type._id;
      delete parsedQuery.type;

      return getDocumentsCore(parsedQuery);
    }
  }

  // Otherwise (General case): Exclude the personal documents
  parsedQuery.documentType_id = {
    $ne: personalType._id,
  };
  return getDocumentsCore(parsedQuery);
};

// Upload an administrative document service: STILL NOT TESTED
export const uploadAdminDocumentService = async ({
  file,
  title,
  documentTypeId,
  uploadedBy,
}) => {
  if (!file) {
    throw new AppError(
      commonErrors.NO_FILE_UPLOADED.message,
      commonErrors.NO_FILE_UPLOADED.code,
      commonErrors.NO_FILE_UPLOADED.errorCode,
      commonErrors.NO_FILE_UPLOADED.suggestion,
    );
  }

  const type = await DocumentType.findById(documentTypeId);
  if (!type) {
    throw new AppError(
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.message,
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.code,
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.errorCode,
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.suggestion,
    );
  }

  // Compute the file hash for duplicate detection
  const fileHash = crypto
    .createHash("sha256")
    .update(file.buffer)
    .digest("hex");

  // Check for duplicate file 
  const existingDoc = await Document.findOne({ fileHash });
  if (existingDoc) {
    throw new AppError(
      errors.DUPLICATE_FILE.message,
      errors.DUPLICATE_FILE.code,
      errors.DUPLICATE_FILE.errorCode,
      errors.DUPLICATE_FILE.suggestion,
    );
  }

  const fileData = await uploadDocumentCore(
    file,
    "hrcom/admin_docs/images",
    "hrcom/admin_docs/docs"
  );

  const document = await Document.create({
    title: title || file.originalname,
    ...fileData,
    documentType_id: type._id,
    uploadedBy,
    user_id: null,
    projectId: null,
    isConfidential: false, 
    fileHash,
  });

  return {
    status: "Success",
    code: 201,
    message: "Administrative document uploaded successfully!",
    data: document,
  };
};

// Delete an administrative document service: STILL NOT TESTED
export const deleteAdminDocumentService = async ({ documentId }) => {
  const document = await Document.findById(documentId);
  if (!document) throw new AppError(
    commonErrors.DOCUMENT_NOT_FOUND.message,
    commonErrors.DOCUMENT_NOT_FOUND.code,
    commonErrors.DOCUMENT_NOT_FOUND.errorCode,
    commonErrors.DOCUMENT_NOT_FOUND.suggestion,
  );

  await deleteDocumentCore(document);

  return {
    status: "Success",
    message: "Administrative document deleted successfully!",
    code: 200,
  };
};

// Download a personal document service: STILL NOT TESTED
export const downloadAdminDocumentService = async ({ documentId, res }) => {
  // Validate the document existence and type
  const document = await getValidAdminDocument(documentId);

  await downloadDocumentCore(document, res);

  return {
    status: "Success",
    code: 200,
    message: "Administrative document downloaded successfully!",
  };
};

// Consult a personal document service: STILL NOT TESTED
export const consultAdminDocumentService = async ({ documentId }) => {
  // Validate the document existence and type
  const document = await getValidAdminDocument(documentId);

  return await consultDocumentCore(document);
};
