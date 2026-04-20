import Project from "../models/Project.js";
import Sprint from "../models/Sprint.js";
import AppError from "./AppError.js";
import { errors as projectErrors } from "../errors/projectErrors.js";
import { errors as sprintErrors } from "../errors/sprintErrors.js";

// Check if a sprint or the project exists
export const checkSprintAndProjectExistence = async (sprintId) => {
  // Check the sprint existence
  const sprint = await Sprint.findById(sprintId);
  if (!sprint) {
    throw new AppError(
      sprintErrors.SPRINT_NOT_FOUND.message,
      sprintErrors.SPRINT_NOT_FOUND.code,
      sprintErrors.SPRINT_NOT_FOUND.errorCode,
      sprintErrors.SPRINT_NOT_FOUND.suggestion,
    );
  }

  // Check the project existence
  const project = await Project.findById(sprint.projectId);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  return { sprint, project };
};
