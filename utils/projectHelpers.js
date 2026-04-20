import { errors } from "../errors/projectErrors.js";
import AppError from "./AppError.js";
import TeamMember from "../models/TeamMember.js";

// Check if the user is a team member, product owner of the project or admins to allow access to the project resources
export const isTeamMemberOrProductOwnerOrAdmin = async (
  project,
  user,
  errorMessage = errors.UNAUTHORIZED_TO_ACCESS_PROJECT
) => {
  const userId = user.id;

  const isProductOwner =
    project.productOwnerId.toString() === userId.toString();

  const isAdmin = user.role === "Admin";

  const membership = await TeamMember.findOne({
    userId,
    teamId: project.team_id,
  });

  // Convert membership to boolean to check if the user is a team member of the project
  const isTeamMember = !!membership;

  if (!isProductOwner && !isAdmin && !isTeamMember) {
    throw new AppError(
      errorMessage.message,
      errorMessage.code,
      errorMessage.errorCode,
      errorMessage.suggestion
    );
  }
};
