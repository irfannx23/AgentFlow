export type PackageReadiness = {
  requirementsReady: boolean
  workflowReady: boolean
  deploymentReady: boolean
  environmentReady: boolean
  testingReady: boolean
  architectureReviewReady: boolean
  exportReady: boolean
  zipValid: boolean
}

export function productionPackageReady(state: PackageReadiness) {
  return Object.values(state).every(Boolean)
}
