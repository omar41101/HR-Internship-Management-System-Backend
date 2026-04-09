import {
    getTeamRoles
} from "../controllers/teamMemberController.js";
import express from "express";
import authenticate from "../middleware/authenticate.js";

const router = express.Router();

// Route to get all possible team roles (Except "Scrum Master")
router.get("/team-roles", authenticate, getTeamRoles);

export default router;
