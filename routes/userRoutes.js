import express from "express"
import {
    login,
    addUser,
    updateUser,
    deleteUser,
    getAllUsers,
    getUserById
} from "../controllers/userController.js";
import authorizeRole from "../middleware/rolePermission.js";

const router = express.Router();

// Route for user login
router.post("/login", login);

// Route to add new user
router.post("/users", authorizeRole("Admin"), addUser);

// Route to update user
router.put("/users/:id", authorizeRole("Admin"), updateUser);

// Route to delete user
router.delete("/users/:id", authorizeRole("Admin"), deleteUser);

// Route to get all users
router.get("/users", authorizeRole("Admin"), getAllUsers);

// Route to get a user by id
router.get("/users/:id", getUserById);

export default router;