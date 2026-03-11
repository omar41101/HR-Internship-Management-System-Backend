import express from "express";
import {
  addDocumentType,
  getAllDocumentTypes,
  getDocumentTypeById,
  updateDocumentType,
} from "../controllers/documentTypeController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Route to add a new document type (Admin only)
router.post("/document-types", authenticate, authorize(["Admin"]), addDocumentType);

// Route to get all document types (Admin only)
router.get("/document-types", authenticate, authorize(["Admin"]), getAllDocumentTypes);

// Route to get a specific document type by ID (Admin only)
router.get("/document-types/:id", authenticate, authorize(["Admin"]), getDocumentTypeById);

// Route to update a specific document type by ID (Admin only)
router.put("/document-types/:id", authenticate, authorize(["Admin"]), updateDocumentType);

export default router;
