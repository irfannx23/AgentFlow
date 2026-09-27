export const PROJECT_STAGE = {
  businessProblem: 'Business Problem',
  requirements: 'Requirements',
  workflowPlanning: 'Workflow Planning',
  workflowDesign: 'Workflow Design',
  workflowGeneration: 'Workflow Generation',
  review: 'Review',
  export: 'Export',
} as const

export const PROJECT_STAGES = Object.values(PROJECT_STAGE)

export type ProjectStage = (typeof PROJECT_STAGES)[number]

export function normalizeProjectStage(value: string): ProjectStage {
  return PROJECT_STAGES.includes(value as ProjectStage)
    ? value as ProjectStage
    : PROJECT_STAGE.businessProblem
}

export function projectStageForRequirements(status: string | null | undefined): ProjectStage | null {
  if (status === 'ready') return PROJECT_STAGE.workflowDesign
  if (status === 'planning') return PROJECT_STAGE.workflowPlanning
  if (status === 'gathering') return PROJECT_STAGE.requirements
  return null
}

export function shouldAdvanceProjectStage(current: string, next: ProjectStage) {
  const currentIndex = PROJECT_STAGES.indexOf(current as ProjectStage)
  const nextIndex = PROJECT_STAGES.indexOf(next)
  return currentIndex >= 0 && nextIndex > currentIndex
}
