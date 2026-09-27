import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { PROJECT_STAGE, PROJECT_STAGES, projectStageForRequirements, shouldAdvanceProjectStage } from '@/lib/projects/lifecycle'
import { supabaseError } from '@/lib/supabase/errors'

const migrationName = '20260927020000_project_stage_lifecycle.sql'

test('database constraint accepts every project stage written by the application', () => {
  const migration = readFileSync(join(process.cwd(), 'supabase', 'migrations', migrationName), 'utf8')
  const constrainedStages = [...migration.matchAll(/'([^']+)'/g)].map(match => match[1])

  assert.deepEqual(constrainedStages, [...PROJECT_STAGES])
  assert.equal(new Set(constrainedStages).size, PROJECT_STAGES.length)
})

test('requirements lifecycle maps to retry-safe project stages', () => {
  assert.equal(projectStageForRequirements('gathering'), PROJECT_STAGE.requirements)
  assert.equal(projectStageForRequirements('planning'), PROJECT_STAGE.workflowPlanning)
  assert.equal(projectStageForRequirements('ready'), PROJECT_STAGE.workflowDesign)
  assert.equal(projectStageForRequirements('unknown'), null)
  assert.equal(shouldAdvanceProjectStage(PROJECT_STAGE.businessProblem, PROJECT_STAGE.workflowPlanning), true)
  assert.equal(shouldAdvanceProjectStage(PROJECT_STAGE.export, PROJECT_STAGE.workflowDesign), false)
})

test('Supabase errors become JavaScript Error instances without losing safe messages', () => {
  const error = supabaseError({ code: '23514', message: 'violates check constraint projects_stage_valid' })
  assert.ok(error instanceof Error)
  assert.equal(error.name, 'SupabaseError')
  assert.equal(error.message, 'violates check constraint projects_stage_valid')
  assert.equal((error as Error & { code?: string }).code, '23514')
})
