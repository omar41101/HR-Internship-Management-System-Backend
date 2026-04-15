import TeamMember from "../models/TeamMember.js";

// Get the list of all possible team roles (Except "Scrum Master")
export const getTeamRoles = async (req, res, next) => {
  try {
    const roles = TeamMember.schema.path("role").enumValues
      .filter((role) => role !== "Scrum Master");

    res.status(200).json({
      status: "Success",
      roles,
    });
  } catch (err) {
    next(err);
  }
};

// WE'LL DEAL WITH THIS LATER
// Get team members under a supervisor (Supervisor and Admin)
export const getTeamMembers = async (req, res, next) => {
  try {
    const { id } = req.params; // Supervisor ID
    const { page = 1 } = req.query;

    const limit = 10; // 10 team members per page
    const parsedPage = Math.max(parseInt(page), 1);

    // Check if the user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return sendError(res, "User not found!", 404);
    }

    // Only the supervisor himself and the Admin can access the team members list
    if (req.user.role !== "Admin" && req.user._id.toString() !== id) {
      return sendError(res, "Unauthorized access to this team!", 403);
    }

    // Build the query
    const query = { supervisor_id: id };

    // Count the total team members
    const totalMembers = await User.countDocuments(query);

    // Find the paginated list of team members of the supervisor (10 per page)
    const teamMembers = await User.find(query)
      .populate("role_id", "name")
      .populate("department_id", "name")
      .skip((parsedPage - 1) * limit)
      .limit(limit)
      .sort({ joinDate: -1 });

    res.status(200).json({
      status: "Success",
      page: parsedPage,
      limit: limit,
      totalPages: Math.ceil(totalMembers / limit),
      totalMembers,
      data: teamMembers,
    });
  } catch (err) {
    next(err);
  }
};
