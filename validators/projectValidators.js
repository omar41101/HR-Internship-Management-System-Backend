import { errors } from "../errors/projectErrors.js";

// Helper function to check if the project is archived, completed or on hold
export const isProjectInactive = (project) => {
  if (project.status === "Archived") {
    throw new AppError(
      errors.ARCHIVED_PROJECT.message,
      errors.ARCHIVED_PROJECT.code,
      errors.ARCHIVED_PROJECT.errorCode,
      errors.ARCHIVED_PROJECT.suggestion
    );
  }
  else if (project.status === "On Hold") {
    throw new AppError(
      errors.ON_HOLD_PROJECT.message,
      errors.ON_HOLD_PROJECT.code,
      errors.ON_HOLD_PROJECT.errorCode,
      errors.ON_HOLD_PROJECT.suggestion
    );
  }
  else if (project.status === "Completed") {
    throw new AppError(
      errors.COMPLETED_PROJECT.message,
      errors.COMPLETED_PROJECT.code,
      errors.COMPLETED_PROJECT.errorCode,
      errors.COMPLETED_PROJECT.suggestion
    );
  }
};

// Helper function to check if the project is completed or on hold
export const isProjectCompletedOrOnHold = async (project) => {
  return ["Completed", "On Hold"].includes(project.status);
};

export const ensureCanUpdateProject = (project, userId) => {
  if (project.status === "Archived") {
    throw new AppError(
      errors.ARCHIVED_PROJECT.message,
      errors.ARCHIVED_PROJECT.code,
      errors.ARCHIVED_PROJECT.errorCode,
      errors.ARCHIVED_PROJECT.suggestion
    );
  }

  if (project.productOwnerId.toString() !== userId.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_UPDATE_PROJECT.message,
      errors.UNAUTHORIZED_TO_UPDATE_PROJECT.code,
      errors.UNAUTHORIZED_TO_UPDATE_PROJECT.errorCode,
      errors.UNAUTHORIZED_TO_UPDATE_PROJECT.suggestion
    );
  }
};
