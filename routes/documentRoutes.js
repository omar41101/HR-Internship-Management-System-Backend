import express from "express";
import {
  uploadPersonalDocument,
  deletePersonalDocument,
  downloadPersonalDocument,
  consultPersonalDocument,
  getAllPersonalDocuments,
  getNonConfidentialPersonalDocuments,
  toggleConfidentiality,
} from "../controllers/documentController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { upload } from "../middleware/upload.js";
import Document from "../models/Document.js";
import AppError from "../utils/AppError.js";

const router = express.Router();

// Helper middleware to extract the document owner's ID
// so that authorize() can check "allowSelf" correctly.
const attachDocumentOwner = async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return next(new AppError("Document not found", 404));
    req.targetUserId = doc.user_id.toString();
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * tags:
 *   - name: Personal Documents
 *     description: Endpoints for the personal documents CRUDs
 */

// Route to upload a personal document (The User himself and Admin)
/**
 * @swagger
 * /api/documents/personal-doc/{id}:
 *   post:
 *     summary: Upload a personal document
 *     tags:
 *        - Personal Documents
 *     description: Upload a personal document for a user (Admin or the user himself).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Target user ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - personalDocument
 *             properties:
 *               title:
 *                 type: string
 *                 example: Passport
 *               personalDocument:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Personal document uploaded successfully
 *       400:
 *         description: No file uploaded
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized (Admin or the user himself only)
 *       404:
 *         description: User or document type not found
 *       500:
 *         description: Server Error
 */
router.post(
  "/documents/personal-doc/:id", // :id = Target user's ID
  authenticate,
  authorize(["Admin"], { allowSelf: true }),
  upload("doc").single("personalDocument"),
  uploadPersonalDocument,
);

// Route to delete a personal document (The User himself and Admin)
/**
 * @swagger
 * /api/documents/personal-doc/{id}:
 *   delete:
 *     summary: Delete a personal document
 *     tags:
 *       - Personal Documents
 *     description: Delete a personal document (Admin or the user himself).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Document ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Personal document deleted successfully
 *       401:
 *         description: Missing/Invalid token
 *       404:
 *         description: Document not found
 *       403:
 *         description: Not a personal document | Unauthorized (Admin or the user himself only)
 *       500:
 *         description: Server Error
 */
router.delete(
  "/documents/personal-doc/:id", // :id = Document's ID
  authenticate,
  attachDocumentOwner,
  authorize(["Admin"], { allowSelf: true }),
  deletePersonalDocument,
);

// Route to Download a document (The User himself, Admin and the user's supervisor)
/**
 * @swagger
 * /api/documents/personal-doc/download/{id}:
 *   get:
 *     summary: Download a personal document
 *     tags:
 *      - Personal Documents
 *     description: Download a personal document (Admin, user himself, or supervisor).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Document ID
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to Cloudinary download URL
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Not a personal document | Unauthorized (Admin, user himself, or supervisor only)
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server Error
 */
router.get(
  "/documents/personal-doc/download/:id",
  authenticate,
  attachDocumentOwner,
  authorize(["Admin"], { allowSelf: true, allowSupervisor: true }),
  downloadPersonalDocument,
);

// Route to consult a document (The User himself, Admin and the user's supervisor)
/**
 * @swagger
 * /api/documents/personal-doc/consult/{id}:
 *   get:
 *     summary: Consult a personal document
 *     tags:
 *       - Personal Documents
 *     description: Open a personal document in the browser (Admin, user himself, or supervisor).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Document ID
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to Cloudinary file URL
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Not a personal document | Unauthorized (Admin, user himself, or supervisor only)
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server Error
 */
router.get(
  "/documents/personal-doc/consult/:id",
  authenticate,
  attachDocumentOwner,
  authorize(["Admin"], { allowSelf: true, allowSupervisor: true }),
  consultPersonalDocument,
);

// Route to get all personal documents of a user (User himself or Admin)
/**
 * @swagger
 * /api/documents/personal-docs/{id}:
 *   get:
 *     summary: Get all personal documents of a user
 *     tags:
 *      - Personal Documents
 *     description: Retrieve all personal documents of a user including confidential ones (Admin or the user himself).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Target user ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of personal documents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: Success
 *                 documents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       format:
 *                         type: string
 *                       size:
 *                         type: number
 *                       fileURL:
 *                         type: string
 *                       isConfidential:
 *                         type: boolean
 */
router.get(
  "/documents/personal-docs/:id", // :id = Target user's ID
  authenticate,
  authorize(["Admin"], { allowSelf: true }),
  getAllPersonalDocuments,
);

// Route to get all the non-confidential personal documents of a user (User himself or Admin or the supervisor)
/**
 * @swagger
 * /api/documents/personal-docs/non-confidential/{id}:
 *   get:
 *     summary: Get non-confidential personal documents
 *     tags:
 *      - Personal Documents
 *     description: Retrieve non-confidential personal documents of a user (Admin, user himself, or supervisor).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Target user ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of non-confidential personal documents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: Success
 *                 documents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       format:
 *                         type: string
 *                       size:
 *                         type: number
 *                       fileURL:
 *                         type: string
 */
router.get(
  "/documents/personal-docs/non-confidential/:id", // :id = Target user's ID
  authenticate,
  authorize(["Admin"], { allowSelf: true, allowSupervisor: true }),
  getNonConfidentialPersonalDocuments,
);

// Route to toggle confidentiality of a personal document (The User himself and Admin)
/**
 * @swagger
 * /api/documents/personal-doc/toggle-confidentiality/:id:
 *   put:
 *     tags:
 *       - Documents
 *     summary: Toggle document confidentiality (The user himself and Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status toggled successfully
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Not a personal document | Unauthorized (Admin or the user himself only)
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
router.put(
  "/documents/personal-doc/toggle-confidentiality/:id", // :id = Document's ID
  authenticate,
  attachDocumentOwner,
  authorize(["Admin"], { allowSelf: true }),
  toggleConfidentiality,
);

export default router;
