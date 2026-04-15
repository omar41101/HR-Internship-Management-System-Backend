import DocumentType from "../models/DocumentType.js";
import AppError from "../utils/AppError.js";
import { isEmpty } from "../validators/userValidators.js";

// Add new Document Type Functionnality
export const addDocumentType = async (req, res, next) => {
  // Get the new document type credentials
  let { name, description } = req.body;

    // Check for empty name field (required)
    if (isEmpty(name)) {
        throw new AppError("The name field must be filled!", 400);
    }

    name = name.trim();
    description = description ? description.trim() : "";

    try {
        // Check for document type name existence
        const existingDocumentTypeName = await DocumentType.findOne({ name: name });
        if (existingDocumentTypeName) {
            throw new AppError("Document type name already exists!", 400);
        }

        // Save the new document type in the Database
        const documentType = await DocumentType.create({
            name: name,
            description: description,
        });

        res.status(201).json({
            status: "Success",
            message: "Document type added successfully!",
            data: { documentType },
        });
    }
    catch (err) {
        next(err);
    }
};

// Get all Document Types Functionnality
export const getAllDocumentTypes = async (req, res, next) => {
    try {
        const documentTypes = await DocumentType.find();
        res.status(200).json({
            status: "Success",  
            data: { documentTypes },
        });
    }
    catch (err) {
        next(err);
    }
};

// Get a specific Document Type Functionnality
export const getDocumentTypeById = async (req, res, next) => {
    const { id } = req.params;
    try {
        // Check document type existence
        const documentType = await DocumentType.findById(id);
        if (!documentType) {
            throw new AppError("Document type not found!", 404);
        }

        res.status(200).json({
            status: "Success",
            data: { documentType },
        });
    }
    catch (err) {
        next(err);
    }
};

// Update a specific Document Type Functionnality
export const updateDocumentType = async (req, res, next) => {
    const { id } = req.params;
    const { name, description } = req.body;
    try {
        // Check document type existence
        const documentType = await DocumentType.findById(id);
        if (!documentType) {
            throw new AppError("Document type not found!", 404);
        }

        if (name) {
            if (isEmpty(name)) {
                throw new AppError("The name field must be filled!", 400);
            }

            const existingDocumentTypeName = await DocumentType.findOne({ name: name, _id: { $ne: id } }); // $ne = Not equal
            if (existingDocumentTypeName) {
                throw new AppError("Document type name already exists!", 400);
            }
            documentType.name = name.trim();
        }

        if (description) {
            documentType.description = description.trim();
        }

        await documentType.save();

        res.status(200).json({
            status: "Success",
            message: "Document type updated successfully!",
            data: { documentType },
        });
    }
    catch (err) {
        next(err);
    }
};
