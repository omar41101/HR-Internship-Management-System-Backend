import express from "express";
import {
    uploadPersonalDocument,
    deletePersonalDocument,
    downloadPersonalDocument,
    consultPersonalDocument,
    getAllPersonalDocuments,
    getNonConfidentialPersonalDocuments
} from "../controllers/documentController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// Route to upload a personal document (The User himself and Admin)
router.post(
  "/documents/personal-doc/:id",  // :id = Target user's ID
  authenticate,
  authorize(["Admin"], { allowSelf: true }),
  upload("doc").single("personalDocument"),
  uploadPersonalDocument
);

// Route to delete a personal document (The User himself and Admin)
router.delete(
  "/documents/personal-doc/:id",  // :id = Document's ID
  authenticate,
  authorize(["Admin"], { allowSelf: true }),
  deletePersonalDocument
);

// Route to Download a document (The User himself, Admin and the user's supervisor)
router.get(
  "/documents/personal-doc/download/:id",
  authenticate,
  authorize(["Admin"], { allowSelf: true , allowSupervisor: true }),
  downloadPersonalDocument
);

// Route to consult a document (The User himself, Admin and the user's supervisor)
router.get(
  "/documents/personal-doc/consult/:id",
  authenticate,
  authorize(["Admin"], { allowSelf: true , allowSupervisor: true }),
  consultPersonalDocument
);

// Route to get all personal documents of a user (User himself or Admin)
router.get(
  "/documents/personal-docs/:id",  // :id = Target user's ID
  authenticate,
  authorize(["Admin"], { allowSelf: true }),
  getAllPersonalDocuments
);

// Route to get all the non-confidential personal documents of a user (User himself or Admin or the supervisor)
router.get(
  "/documents/personal-docs/non-confidential/:id",  // :id = Target user's ID
  authenticate,
  authorize(["Admin"], { allowSelf: true , allowSupervisor: true }),
  getNonConfidentialPersonalDocuments
);

export default router;