import express from "express";
import {
    uploadPersonalDocument,
    deletePersonalDocument
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

export default router;