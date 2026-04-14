// Define common errors that can be used across the application
export const errors = {
  NOT_FOUND: {
    message: "Document not found",
    code: 404,
    errorCode: "NOT_FOUND"
  },
  DELETED_USER: {
    message: "User not found or deleted",
    code: 404,
    errorCode: "USER_DELETED"
  }
};
