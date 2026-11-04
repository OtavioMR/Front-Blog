// The editorial workflow is enabled only after the review queue has been validated.
export function editorialWorkflowEnabled(): boolean {
  return process.env.EDITORIAL_WORKFLOW_ENABLED === "true";
}
