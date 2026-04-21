import Task from "../models/Task.js";
import Team from "../models/Team.js";
import TeamMember from "../models/TeamMember.js";
import User from "../models/User.js";
import { errors as projectErrors } from "../errors/projectErrors.js";
import { errors } from "../errors/teamErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors as tokenErrors } from "../errors/middlewareTokenErrors.js";
import AppError from "../utils/AppError.js";
import { getAll } from "./handlersFactory.js";
import { assertTeamAccess } from "../utils/teamHelpers.js";

// Get the list of team roles
export const getTeamRoles = async () => {
  const roles = TeamMember.schema.path("role").enumValues;

  return {
    status: "Success",
    code: 200,
    message: "Team roles retrieved successfully!",
    data: roles,
  };
};

// Add a team member to a team
export const addTeamMember = async (teamId, userId, role, currentUser) => {
  // Check the team existence
  const team = await Team.findById(teamId).populate("projectId");
  if (!team)
    throw new AppError(
      projectErrors.TEAM_NOT_FOUND.message,
      projectErrors.TEAM_NOT_FOUND.code,
      projectErrors.TEAM_NOT_FOUND.errorCode,
      projectErrors.TEAM_NOT_FOUND.suggestion,
    );

  // Authorize only the Product Owner of the project to add team members
  if (team.projectId.productOwnerId.toString() !== currentUser.id) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_ADD_TEAM_MEMBER.message,
      errors.UNAUTHORIZED_TO_ADD_TEAM_MEMBER.code,
      errors.UNAUTHORIZED_TO_ADD_TEAM_MEMBER.errorCode,
      errors.UNAUTHORIZED_TO_ADD_TEAM_MEMBER.suggestion,
    );
  }

  // Check if the new team member has as supervisor (supervisor_id) = the project product owner
  const teamMember = await User.findById(userId);
  if (
    !teamMember ||
    teamMember.supervisor_id !== team.projectId.productOwnerId
  ) {
    throw new AppError(
      errors.TEAM_MEMBER_NOT_AUTHORIZED.message,
      errors.TEAM_MEMBER_NOT_AUTHORIZED.code,
      errors.TEAM_MEMBER_NOT_AUTHORIZED.errorCode,
      errors.TEAM_MEMBER_NOT_AUTHORIZED.suggestion,
    );
  }

  // Check if the user is already a member of the team
  const existingMember = await TeamMember.findOne({ teamId, userId });
  if (existingMember) {
    throw new AppError(
      projectErrors.DUPLICATE_USERS.message,
      projectErrors.DUPLICATE_USERS.code,
      projectErrors.DUPLICATE_USERS.errorCode,
      projectErrors.DUPLICATE_USERS.suggestion,
    );
  }

  // Check if the new team member is assigned the "Scrum Master" role while there is already a scrum master in the team
  if (role === "Scrum Master") {
    const existingScrumMaster = await TeamMember.findOne({
      teamId,
      role: "Scrum Master",
    });
    if (existingScrumMaster) {
      throw new AppError(
        projectErrors.MORE_THAN_ONE_SCRUM_MASTER.message,
        projectErrors.MORE_THAN_ONE_SCRUM_MASTER.code,
        projectErrors.MORE_THAN_ONE_SCRUM_MASTER.errorCode,
        projectErrors.MORE_THAN_ONE_SCRUM_MASTER.suggestion,
      );
    }
  }

  // Create the new team member
  const newMember = await TeamMember.create({
    teamId,
    userId,
    role,
  });

  return {
    status: "Success",
    code: 201,
    message: "Team member added successfully!",
    data: newMember,
  };
};

// Update a team member's role in the team
export const updateTeamMember = async (
  teamMemberId,
  { role, isActive },
  currentUser,
) => {
  // Check the team member existence
  const member = await TeamMember.findById(teamMemberId).populate({
    path: "teamId",
    populate: { path: "projectId" },
  });
  if (!member) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  const project = member.teamId.projectId;

  // Authorization: Only the Product Owner of the project can update the team members
  if (project.productOwnerId.toString() !== currentUser.id) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_UPDATE_TEAM_MEMBER_ROLE.message,
      errors.UNAUTHORIZED_TO_UPDATE_TEAM_MEMBER_ROLE.code,
      errors.UNAUTHORIZED_TO_UPDATE_TEAM_MEMBER_ROLE.errorCode,
      errors.UNAUTHORIZED_TO_UPDATE_TEAM_MEMBER_ROLE.suggestion,
    );
  }

  // Update the team member's role
  if (role) {
    // Validate the new role value
    const validRoles = TeamMember.schema.path("role").enumValues;
    if (!validRoles.includes(role)) {
      throw new AppError(
        errors.INVALID_ROLE.message,
        errors.INVALID_ROLE.code,
        errors.INVALID_ROLE.errorCode,
        errors.INVALID_ROLE.suggestion,
      );
    }

    // Scrum Master uniqueness
    if (role === "Scrum Master") {
      const existingScrumMaster = await TeamMember.findOne({
        teamId: member.teamId,
        role: "Scrum Master",
        _id: { $ne: teamMemberId },
      });

      if (existingScrumMaster) {
        throw new AppError(
          projectErrors.MORE_THAN_ONE_SCRUM_MASTER.message,
          projectErrors.MORE_THAN_ONE_SCRUM_MASTER.code,
          projectErrors.MORE_THAN_ONE_SCRUM_MASTER.errorCode,
          projectErrors.MORE_THAN_ONE_SCRUM_MASTER.suggestion,
        );
      }
    }

    member.role = role;
  }

  // Update the isActiveInProject status of the team member
  if (isActive !== undefined) {
    // Prevent deactivating a team member with active tasks
    if (isActive === false) {
      const hasActiveTasks = await Task.exists({
        assignedTo: member.userId,
        projectId: project._id,
        status: "In Progress",
      });

      if (hasActiveTasks) {
        throw new AppError(
          errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.message,
          errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.code,
          errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.errorCode,
          errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.suggestion,
        );
      }

      // Prevent deactivating Scrum Master
      if (member.role === "Scrum Master") {
        throw new AppError(
          errors.CANNOT_DEACTIVATE_SCRUM_MASTER.message,
          errors.CANNOT_DEACTIVATE_SCRUM_MASTER.code,
          errors.CANNOT_DEACTIVATE_SCRUM_MASTER.errorCode,
          errors.CANNOT_DEACTIVATE_SCRUM_MASTER.suggestion,
        );
      }
    }

    member.isActiveInProject = isActive;
  }

  await member.save();

  return {
    status: "Success",
    message: "Team member updated successfully",
    code: 200,
    data: member,
  };
};

// Remove a team member from a team
export const removeTeamMember = async (teamMemberId, currentUser) => {
  // Check the team member existence
  const member = await TeamMember.findById(teamMemberId).populate({
    path: "teamId",
    populate: { path: "projectId" },
  });
  if (!member)
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );

  const project = member.teamId.projectId;

  // Authorize only the Product Owner of the project to remove team members
  if (project.productOwnerId.toString() !== currentUser.id) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_REMOVE_TEAM_MEMBER.message,
      errors.UNAUTHORIZED_TO_REMOVE_TEAM_MEMBER.code,
      errors.UNAUTHORIZED_TO_REMOVE_TEAM_MEMBER.errorCode,
      errors.UNAUTHORIZED_TO_REMOVE_TEAM_MEMBER.suggestion,
    );
  }

  // Check if the team member has active tasks in the project
  const hasActiveTasks = await Task.exists({
    assignedTo: member.userId,
    projectId: project._id,
    status: "In Progress",
  });
  if (hasActiveTasks) {
    throw new AppError(
      errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.message,
      errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.code,
      errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.errorCode,
      errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.suggestion,
    );
  }

  // Unassign the tasks from the removed team member
  await Task.updateMany(
    { assignedTo: member.userId, projectId: project._id },
    { $set: { assignedTo: null } },
  );

  await member.deleteOne();

  return {
    status: "Success",
    code: 200,
    message: "Team member removed successfully",
  };
};

// Replace a team member with another user in the team
export const replaceTeamMember = async (
  oldMemberId,
  newUserId,
  currentUser,
) => {
  // Check the old team member existence
  const oldMember = await TeamMember.findById(oldMemberId).populate({
    path: "teamId",
    populate: { path: "projectId" },
  });
  if (!oldMember)
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );

  const project = oldMember.teamId.projectId;

  // Authorize only the Product Owner of the project to replace team members
  if (project.productOwnerId.toString() !== currentUser.id) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_REPLACE_TEAM_MEMBER.message,
      errors.UNAUTHORIZED_TO_REPLACE_TEAM_MEMBER.code,
      errors.UNAUTHORIZED_TO_REPLACE_TEAM_MEMBER.errorCode,
      errors.UNAUTHORIZED_TO_REPLACE_TEAM_MEMBER.suggestion,
    );
  }

  // Check if the new user exists and has as a supervisor (supervisor_id) = the project product owner
  const newUser = await User.findById(newUserId);
  if (!newUser || newUser.supervisor_id !== project.productOwnerId.toString()) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Check if the new user is already a member of the team
  const existingMember = await TeamMember.findOne({
    teamId: oldMember.teamId._id,
    userId: newUserId,
  });
  if (existingMember) {
    throw new AppError(
      errors.TEAM_MEMBER_ALREADY_EXISTS.message,
      errors.TEAM_MEMBER_ALREADY_EXISTS.code,
      errors.TEAM_MEMBER_ALREADY_EXISTS.errorCode,
      errors.TEAM_MEMBER_ALREADY_EXISTS.suggestion,
    );
  }

  // Create new member
  const newMember = await TeamMember.create({
    teamId: oldMember.teamId._id,
    userId: newUserId,
    role: oldMember.role,
  });

  // Transfer the tasks
  await Task.updateMany(
    { assignedTo: oldMember.userId, projectId: project._id },
    { $set: { assignedTo: newUserId } },
  );

  // Deactivate the old team member
  oldMember.isActiveInProject = false;
  await oldMember.save();

  return {
    status: "Success",
    message: "Team member replaced successfully",
    code: 200,
    data: newMember,
  };
};

// Get all team members of a team
export const getProjectTeamMembers = async (queryParams, teamId, user) => {
  // Check the team existence
  const team = await Team.findById(teamId).populate("projectId");
  if (!team) {
    throw new AppError(
      projectErrors.TEAM_NOT_FOUND.message,
      projectErrors.TEAM_NOT_FOUND.code,
      projectErrors.TEAM_NOT_FOUND.errorCode,
      projectErrors.TEAM_NOT_FOUND.suggestion,
    );
  }

  // Authorize access to the team members list (Admin, Product Owner, and the project team members can access the team members list)
  await assertTeamAccess(team.projectId, team, user);

  const finalQuery = {
    ...queryParams,
    limit: 6,
    sort: "-createdAt",
  };

  return await getAll(TeamMember, commonErrors.USER_NOT_FOUND, [
    { path: "teamId", select: "name" },
    { path: "userId", select: "name email" },
  ])(finalQuery);
};

// Get team members under a supervisor (Supervisor and Admin)
export const getSupervisorTeamMembers = async (
  supervisorId,
  currentUser,
  queryParams,
) => {
  // Check user existence
  const supervisor = await User.findById(supervisorId);
  if (!supervisor) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Authorization
  if (
    currentUser.role !== "Admin" &&
    currentUser._id.toString() !== supervisorId
  ) {
    throw new AppError(
      tokenErrors.UNAUTHORIZED.message,
      tokenErrors.UNAUTHORIZED.code,
      tokenErrors.UNAUTHORIZED.errorCode,
      tokenErrors.UNAUTHORIZED.suggestion,
    );
  }

  // Inject the filter by the supervisor into the queryParams
  const enrichedQueryParams = {
    ...queryParams,
    supervisor_id: supervisorId,
  };

  return await getAll(User, [
    { path: "role_id", select: "name" },
    { path: "department_id", select: "name" },
  ])(enrichedQueryParams);
};
