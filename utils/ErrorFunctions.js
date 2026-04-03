// Helper functions to handle errors in a consistent way across the application

// Error responses (4xx)
export const sendError = (res, message, code = 400) => {
  return res.status(code).json({ status: "Error", message });
};

// Server Error responses
export const handleError = (res, err) => {
  console.error(err);
  return res.status(500).json({ status: "Error", message: err.message });
};
