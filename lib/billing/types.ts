export type BillingPlan = 'free' | 'pro' | 'team'
export type SubscriptionStatus = 'active' | 'pending' | 'past_due' | 'cancelled'

export type BillingUsage = {
  projects: number
  automationRuns: number
  workflowExports: number
  aiRequests: number
  knowledgeUploads: number
  storageBytes: number
  conversations: number
  versions: number
  timelineEvents: number
}

export type Entitlements = {
  canCreateProject: boolean
  canImportWorkflow: boolean
  canExportWorkflow: boolean
  canUseVersionHistory: boolean
  canUseMultipleProviders: boolean
  canGenerateUnlimitedArtifacts: boolean
  canAccessFutureModules: boolean
  projectLimit: number | null
}

export type BillingState = {
  plan: BillingPlan
  status: SubscriptionStatus
  renewalDate: string | null
  cancelAtPeriodEnd: boolean
  usage: BillingUsage
  entitlements: Entitlements
}

export const planLabels: Record<BillingPlan, string> = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team',
}

const freeFeatures = {
  canImportWorkflow: false,
  canExportWorkflow: true,
  canUseVersionHistory: false,
  canUseMultipleProviders: true,
  canGenerateUnlimitedArtifacts: false,
  canAccessFutureModules: false,
  projectLimit: 3,
} as const

export function entitlementsFor(plan: BillingPlan, usage: Pick<BillingUsage, 'projects'>): Entitlements {
  if (plan === 'pro' || plan === 'team') {
    return {
      canCreateProject: true,
      canImportWorkflow: true,
      canExportWorkflow: true,
      canUseVersionHistory: true,
      canUseMultipleProviders: true,
      canGenerateUnlimitedArtifacts: true,
      canAccessFutureModules: plan === 'team',
      projectLimit: null,
    }
  }
  return { ...freeFeatures, canCreateProject: usage.projects < freeFeatures.projectLimit }
}

export const emptyUsage: BillingUsage = {
  projects: 0,
  automationRuns: 0,
  workflowExports: 0,
  aiRequests: 0,
  knowledgeUploads: 0,
  storageBytes: 0,
  conversations: 0,
  versions: 0,
  timelineEvents: 0,
}

export const initialBillingState: BillingState = {
  plan: 'free',
  status: 'active',
  renewalDate: null,
  cancelAtPeriodEnd: false,
  usage: emptyUsage,
  entitlements: entitlementsFor('free', emptyUsage),
}
