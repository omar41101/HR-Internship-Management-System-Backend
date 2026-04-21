import AppError from "../utils/AppError.js";
import { errors } from "../errors/teamErrors.js";
import TeamMember from "../models/TeamMember.js";

/*
    Helper function to help us limit the access to the team details to 
    only the authorized users: Admin, the project's Product Owner, 
    and the project team members.
*/
export const assertTeamAccess = async (project, team, user) => {
  if (!project || !team || !user) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_ACCESS_TEAM.message,
      errors.UNAUTHORIZED_TO_ACCESS_TEAM.code,
      errors.UNAUTHORIZED_TO_ACCESS_TEAM.errorCode,
      errors.UNAUTHORIZED_TO_ACCESS_TEAM.suggestion
    );
  }

  const userId = user.id.toString();

  // The Product Owner of the project always has access
  if (project.productOwnerId?.toString() === userId) {
    return;
  }

  // The Admin always has access
  if (user.role === "Admin") {
    return;
  }

  // Only the team members of the project has access
  const isMember = await TeamMember.exists({
    userId: userId,
    teamId: project.team_id,
  });
  if (isMember) {
    return;
  }

  throw new AppError(
    errors.UNAUTHORIZED_TO_ACCESS_TEAM.message,
    errors.UNAUTHORIZED_TO_ACCESS_TEAM.code,
    errors.UNAUTHORIZED_TO_ACCESS_TEAM.errorCode,
    errors.UNAUTHORIZED_TO_ACCESS_TEAM.suggestion
  );
};
