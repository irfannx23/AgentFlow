import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { integrationCategories, integrationRegistry } from '@/lib/integrations/registry'

test('supported integrations registry exposes reusable production metadata', () => {
  assert.ok(integrationRegistry.length >= 30)
  assert.equal(new Set(integrationRegistry.map(integration => integration.id)).size, integrationRegistry.length)
  for (const integration of integrationRegistry) {
    assert.ok(integrationCategories.includes(integration.category), integration.id)
    assert.ok(integration.description.length > 10, integration.id)
    assert.match(integration.website, /^https:\/\//, integration.id)
    assert.match(integration.documentationUrl, /^https:\/\//, integration.id)
    assert.ok(integration.authenticationType, integration.id)
    assert.ok(integration.supportedOperations.length > 0, integration.id)
    if (integration.logoPath) {
      assert.match(integration.logoPath, /^\/integrations\/[a-z0-9-]+\.svg$/, integration.id)
      assert.equal(existsSync(join(process.cwd(), 'public', integration.logoPath)), true, integration.logoPath)
    }
  }
  assert.ok(integrationRegistry.filter(integration => integration.featured).length >= 6)
  assert.ok(integrationRegistry.some(integration => integration.logoPath))
  assert.ok(integrationRegistry.some(integration => integration.logoPath === null))
})

test('integration explorer preserves its responsive scroll contract', () => {
  const styles = readFileSync(join(process.cwd(), 'app', 'app-styles.css'), 'utf8')
  assert.match(styles, /integration-explorer-backdrop[\s\S]*display:\s*flex[\s\S]*align-items:\s*center[\s\S]*justify-content:\s*center/)
  assert.match(styles, /integration-explorer-modal[\s\S]*width:\s*min\(92vw,\s*1180px\)[\s\S]*max-height:\s*82dvh/)
  assert.match(styles, /integration-explorer-header[\s\S]*flex:\s*none/)
  assert.match(styles, /integration-explorer-toolbar[\s\S]*position:\s*sticky/)
  assert.match(styles, /integration-explorer-body[\s\S]*overflow-y:\s*auto/)
  assert.match(styles, /integration-explorer-footer[\s\S]*flex:\s*none/)
  assert.match(styles, /integration-modal-in[\s\S]*scale\(\.96\)/)
  assert.match(styles, /@media \(max-width:\s*900px\)/)
  assert.match(styles, /@media \(max-width:\s*620px\)/)
  assert.match(styles, /width:\s*95vw[\s\S]*height:\s*90dvh/)
})
