import {
    getTeamRoles,
    getTeamMembers
} from "../controllers/teamMemberController.js";
import express from "express";
import authenticate from "../middleware/authenticate.js";

const router = express.Router();

// Route to get all possible team roles (Except "Scrum Master")
router.get("/team-roles", authenticate, getTeamRoles);

router.get("/team-members/:id", authenticate, getTeamMembers);

// Route to get team members (Supervisor/admin only)
// router.get(
//   "/users/team/:id",  
//   authenticate,
//   authorize(["Admin", "Supervisor"], { allowSelf: true }),
//   getTeamMembers
// );

export default router;
