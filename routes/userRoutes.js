import express from "express"
import {
    login,
    addUser
} from "../controllers/userController.js";

const router = express.Router();

// Route to add new user
router.post("/users", addUser);

// Route for user login
router.post("/login", login);   

export default router; 