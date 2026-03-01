import express from "express"
import {
    login,
    addUser
} from "../controllers/userController.js";
import authorizeRole from "../middleware/rolePermission.js";

const router = express.Router();

// Route to add new user
router.post("/users", authorizeRole("Admin"), addUser);

// Route for user login
router.post("/login", login);   

export default router; 