export const errors = {
  PROJECT_NOT_FOUND: {
    message: "Project not found",
    code: 404,
    errorCode: "PROJECT_NOT_FOUND",
    suggestion: "Please check the existence of the project.",
  },
  PROJECT_ID_REQUIRED: {
    message: "Project ID is required",
    code: 400,
    errorCode: "PROJECT_ID_REQUIRED",
    suggestion: "Please provide a valid project ID.",
  },
  ARCHIVED_PROJECT: {
    message: "Cannot perform this action on an archived project",
    code: 400,
    errorCode: "ARCHIVED_PROJECT",
    suggestion: "Please unarchive the project to perform this action.",
  },
  ON_HOLD_PROJECT: {
    message: "Cannot perform this action on an on-hold project",
    code: 400,
    errorCode: "ON_HOLD_PROJECT",
    suggestion: "Please resume the project to perform this action.",
  },
  COMPLETED_PROJECT: {
    message: "Cannot perform this action on a completed project",
    code: 400,
    errorCode: "COMPLETED_PROJECT",
    suggestion: "Please reopen the project to perform this action.",
  },
  UNAUTHORIZED_TO_ACCESS_PROJECT: {
    message: "Unauthorized to access the project",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_ACCESS_PROJECT",
    suggestion: "You do not have permission to access this project.",
  },
};
