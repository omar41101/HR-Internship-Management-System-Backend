import mongoose from "mongoose";
import { errors } from "../errors/projectErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import AppError from "./AppError.js";
import Team from "../models/Team.js";
import TeamMember from "../models/TeamMember.js";
import User from "../models/User.js";
import Project from "../models/Project.js";

// Helper function to throw a locked error when trying to update locked fields in the project
export const throwLocked = () => {
  throw new AppError(
    errors.LOCKED_PROJECT.message,
    errors.LOCKED_PROJECT.code,
    errors.LOCKED_PROJECT.errorCode,
    errors.LOCKED_PROJECT.suggestion
  );
};

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

// Build the match filter
export const buildProjectMatchFilter = async ({
  userId,
  role,
  name,
  sector,
  status,
  supervisor,
  startDate,
  endDate,
  archived,
}) => {
  const match = {};

  /*
    Authorization Access: Admins can access all projects, supervisors can access projects they own, 
    and employees/interns can access projects where they are team members
  */
  if (role !== "Admin") {
    if (role === "Supervisor") {
      match.productOwnerId = new mongoose.Types.ObjectId(userId);
    } else {
      const teams = await TeamMember.find({ userId }).select("teamId");
      const teamIds = teams.map((t) => t.teamId);

      match.team_id = {
        $in: teamIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }
  }

  // Filter by the archived status
  if (archived === "true") match.status = "Archived";
  else match.status = { $ne: "Archived" };

  // Filters
  if (name) match.name = { $regex: name, $options: "i" };
  if (sector) match.sector = sector;
  if (status) match.status = status;

  if (startDate || endDate) match.startDate = {};
  if (startDate) match.startDate.$gte = new Date(startDate);
  if (endDate) match.startDate.$lte = new Date(endDate);

  if (supervisor) {
    const user = await User.findOne({
      $or: [
        { name: { $regex: supervisor, $options: "i" } },
        { lastName: { $regex: supervisor, $options: "i" } },
      ],
    });

    match.productOwnerId = user ? user._id : null;
  }

  return match;
};

// Build the match filter for accessing a specific project by ID
export const buildProjectAccessMatch = async (projectId, userId, role) => {
  const match = {
    _id: new mongoose.Types.ObjectId(projectId),
  };

  if (role === "Supervisor") {
    match.productOwnerId = new mongoose.Types.ObjectId(userId);
  }

  if (role === "Employee" || role === "Intern") {
    const teams = await TeamMember.find({ userId }).select("teamId");

    if (!teams.length) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_ACCESS_PROJECT.message,
        errors.UNAUTHORIZED_TO_ACCESS_PROJECT.code,
        errors.UNAUTHORIZED_TO_ACCESS_PROJECT.errorCode,
        errors.UNAUTHORIZED_TO_ACCESS_PROJECT.suggestion
      );
    }

    match.team_id = {
      $in: teams.map((t) => new mongoose.Types.ObjectId(t.teamId)),
    };
  }

  return match;
};

// Validate input data for creating a project
export const validateCreateProject = async (data, productOwnerId) => {
  const { name, sector, startDate, dueDate, scrumMasterId } = data;

  // Check for required fields
  if (!name || !sector || !startDate || !dueDate) {
    throw new AppError(
      errors.MISSING_REQUIRED_FIELDS.message,
      errors.MISSING_REQUIRED_FIELDS.code,
      errors.MISSING_REQUIRED_FIELDS.errorCode,
      errors.MISSING_REQUIRED_FIELDS.suggestion
    );
  }

  // Check the project name uniqueness
  const existingProject = await Project.findOne({ name });
  if (existingProject) {
    throw new AppError(
      errors.PROJECT_EXISTS.message,
      errors.PROJECT_EXISTS.code,
      errors.PROJECT_EXISTS.errorCode,
      errors.PROJECT_EXISTS.suggestion
    );
  }

  // Validate the sector
  const allowedSectors = Project.schema.path("sector").enumValues;
  if (!allowedSectors.includes(sector)) {
    throw new AppError(
      errors.INVALID_SECTOR.message,
      errors.INVALID_SECTOR.code,
      errors.INVALID_SECTOR.errorCode,
      errors.INVALID_SECTOR.suggestion
    );
  }

  // Validate the due date is after the start date
  if (new Date(dueDate) < new Date(startDate)) {
    throw new AppError(
      errors.INVALID_DUE_DATE.message,
      errors.INVALID_DUE_DATE.code,
      errors.INVALID_DUE_DATE.errorCode,
      errors.INVALID_DUE_DATE.suggestion
    );
  }

  if (scrumMasterId) {
    // Check the scrum master existence
    const scrumMaster = await User.findById(scrumMasterId).populate("role_id");
    if (!scrumMaster) {
      throw new AppError(
        commonErrors.USER_NOT_FOUND.message,
        commonErrors.USER_NOT_FOUND.code,
        commonErrors.USER_NOT_FOUND.errorCode,
        commonErrors.USER_NOT_FOUND.suggestion
      );
    }

    // Check the scrum master is under the same supervisor as the product owner
    if (scrumMaster.supervisor_id?.toString() !== productOwnerId.toString()) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_ASSIGN_SCRUM_MASTER.message,
        errors.UNAUTHORIZED_TO_ASSIGN_SCRUM_MASTER.code,
        errors.UNAUTHORIZED_TO_ASSIGN_SCRUM_MASTER.errorCode,
        errors.UNAUTHORIZED_TO_ASSIGN_SCRUM_MASTER.suggestion
      );
    }

    // Check the scrum master is not an intern
    if (scrumMaster.role_id?.name === "Intern") {
      throw new AppError(
        errors.INVALID_SCRUM_MASTER.message,
        errors.INVALID_SCRUM_MASTER.code,
        errors.INVALID_SCRUM_MASTER.errorCode,
        errors.INVALID_SCRUM_MASTER.suggestion
      );
    }
  }
};

// Validate the team members to be added to the project
export const validateTeamMembers = async (
  membersToInsert,
  teamMembers,
  productOwnerId
) => {
  // Get the user IDs from the members to be inserted
  const userIds = membersToInsert.map((m) => m.userId.toString());

  // Check for duplicate user IDs in the input
  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length !== userIds.length) {
    throw new AppError(
      errors.DUPLICATE_USERS.message,
      errors.DUPLICATE_USERS.code,
      errors.DUPLICATE_USERS.errorCode,
      errors.DUPLICATE_USERS.suggestion
    );
  }

  // Check the existence of the users 
  const users = await User.find({ _id: { $in: uniqueUserIds } });
  if (users.length !== uniqueUserIds.length) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion
    );
  }

  // Check if the users are under the same supervisor as the product owner
  const invalidUsers = users.filter(
    (u) => u.supervisor_id?.toString() !== productOwnerId.toString()
  );

  if (invalidUsers.length > 0) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_ADD_TEAM_MEMBER.message,
      errors.UNAUTHORIZED_TO_ADD_TEAM_MEMBER.code,
      errors.UNAUTHORIZED_TO_ADD_TEAM_MEMBER.errorCode,
      errors.UNAUTHORIZED_TO_ADD_TEAM_MEMBER.suggestion
    );
  }

  // Ensure that there are no more than one scrum master in the team members to be inserted
  const scrumMastersInTeam = teamMembers.filter(
    (m) => m.role === "Scrum Master"
  );
  if (scrumMastersInTeam.length > 0) {
    throw new AppError(
      errors.MORE_THAN_ONE_SCRUM_MASTER.message,
      errors.MORE_THAN_ONE_SCRUM_MASTER.code,
      errors.MORE_THAN_ONE_SCRUM_MASTER.errorCode,
      errors.MORE_THAN_ONE_SCRUM_MASTER.suggestion
    );
  }
};

// Apply the updates to the project object based on the input data
export const applyProjectUpdates = (project, data, isLocked) => {
  const {
    name,
    sector,
    description,
    startDate,
    dueDate,
    status,
    onHoldReason,
  } = data;

  // Update the project name 
  if (name && name !== project.name) {
    if (isLocked) throwLocked();

    project.name = name;
  }

  // Update the sector name
  if (sector) {
    if (isLocked) throwLocked();

    const allowed = Project.schema.path("sector").enumValues;
    if (!allowed.includes(sector)) throwInvalidSector();

    project.sector = sector;
  }

  // Update the project description
  if (description !== undefined) {
    if (isLocked) throwLocked();
    project.description = description;
  }

  // Update the project start and due dates
  if (startDate || dueDate) {
    if (isLocked) throwLocked();

    const newStart = startDate ? new Date(startDate) : project.startDate;
    const newDue = dueDate ? new Date(dueDate) : project.dueDate;

    if (newDue < newStart) throwInvalidDates();

    project.startDate = newStart;
    project.dueDate = newDue;
  }

  // Update the project status
  if (status) {
    const allowedStatuses = Project.schema.path("status").enumValues;
    if (!allowedStatuses.includes(status)) throwInvalidStatus();

    project.status = status;

    if (status === "On Hold") {
      if (onHoldReason) project.onHoldReason = onHoldReason;
    } else if (onHoldReason) {
      throw new AppError(
        errors.ON_HOLD_REASON_NOT_ALLOWED.message,
        errors.ON_HOLD_REASON_NOT_ALLOWED.code,
        errors.ON_HOLD_REASON_NOT_ALLOWED.errorCode,
        errors.ON_HOLD_REASON_NOT_ALLOWED.suggestion
      );
    }
  }
};

// Helper function to deal with the "Active" status update of a project
export const validateActiveStateIfNeeded = async (project, status) => {
  if (status !== "Active") return;

  // Check the existence of the project team
  const team = await Team.findById(project.team_id);
  if (!team) {
    throw new AppError(
      errors.TEAM_NOT_FOUND.message,
      errors.TEAM_NOT_FOUND.code,
      errors.TEAM_NOT_FOUND.errorCode,
      errors.TEAM_NOT_FOUND.suggestion
    );
  }

  // Count the number of team members in the project team
  const membersCount = await TeamMember.countDocuments({
    teamId: team._id,
  });

  if (!project.scrumMasterId) {
    throw new AppError(
      errors.SCRUM_MASTER_REQUIRED.message,
      errors.SCRUM_MASTER_REQUIRED.code,
      errors.SCRUM_MASTER_REQUIRED.errorCode,
      errors.SCRUM_MASTER_REQUIRED.suggestion
    );
  }

  if (membersCount < 1) {
    throw new AppError(
      errors.TEAM_MEMBERS_REQUIRED.message,
      errors.TEAM_MEMBERS_REQUIRED.code,
      errors.TEAM_MEMBERS_REQUIRED.errorCode,
      errors.TEAM_MEMBERS_REQUIRED.suggestion
    );
  }
};
