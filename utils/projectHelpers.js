// ------------------------------------------------------------------ //
// ------- HELPER FUNCTIONS FOR THE PROJECT MANAGEMENT MODULE ------- //
// ------------------------------------------------------------------ //

// Helper function to check if the project is archived, completed or on hold
export const isProjectInactive = (project) => {
  return ["Archived", "Completed", "On Hold"].includes(project.status);
};
