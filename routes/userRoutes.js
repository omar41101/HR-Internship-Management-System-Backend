import express from "express"
import {
    login,
    addUser,
    updateUser,
    deleteUser,
    getAllUsers,
    getUserById,
    searchUser,
    filterUsers,
    toggleUserStatus,
    exportUsersToCSV,
    exportUsersToExcel
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

// Route to search for users
router.get("/search", authorizeRole("Admin"), searchUser);

// Route to filter users
router.get("/filter", authorizeRole("Admin"), filterUsers);

// Route to toggle the user status
router.put("/users/:id/toggle-status", authorizeRole("Admin"), toggleUserStatus);

// Route to export users to CSV
router.get("/users/export/csv", authorizeRole("Admin"), exportUsersToCSV);

// Route to export users to Excel
router.get("/users/export/excel", authorizeRole("Admin"), exportUsersToExcel);

export default router;