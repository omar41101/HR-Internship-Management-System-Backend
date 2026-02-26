import express from "express";
import {
    addUserRole,
    getAllUserRoles,
    getUserRoleById,
    deleteUserRole,
    updateUserRole
} from "../controllers/userRoleController.js";
import authorizeRole from "../middleware/rolePermission.js";

const router = express.Router();

// Route to add new role
router.post("/roles", authorizeRole("Admin"), addUserRole);

// Route to get all the roles
router.get("/roles", getAllUserRoles); 

// Route to get a role by id
router.get("/roles/:id", getUserRoleById);

// Route to delete a role
router.delete("/roles/:id", authorizeRole("Admin"), deleteUserRole);

// Route to update a role
router.put("/roles/:id", authorizeRole("Admin"), updateUserRole);

export default router;