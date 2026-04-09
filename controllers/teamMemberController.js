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
