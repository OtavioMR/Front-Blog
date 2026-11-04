// The editorial workflow is enabled only when explicitly set to "true".
export function editorialWorkflowEnabled(): boolean {
  return process.env.EDITORIAL_WORKFLOW_ENABLED === "true";
}
