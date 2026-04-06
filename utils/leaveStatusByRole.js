// Helper function to get leave request statuses based on user role
export const getStatusesByRole = (role) => {
  if (role === "Admin") {
    return [
      "Pending Admin Approval",
      "Under Admin Review",
      "Rejected by Admin",
      "Approved",
    ];
  }

  if (role === "Supervisor" || role === "Employee" || role === "Intern") {
    return [
      "Pending Supervisor Approval",
      "Under Supervisor Review",
      "Rejected by Supervisor",
      "Pending Admin Approval",
      "Under Admin Review",
      "Rejected by Admin",
      "Approved",
    ];
  }

  return [];
};
