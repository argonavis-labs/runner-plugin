import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkConformance } from './check-conformance.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function copyRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-plugin-'))
  for (const entry of ['.claude-plugin', '.codex-plugin', '.agents', 'skills', 'plugin.json', 'mcp.json', '.mcp.json']) {
    fs.cpSync(path.join(repoRoot, entry), path.join(dir, entry), { recursive: true })
  }
  return dir
}

// MUST IGNORE: the repository as it stands. If this fails, the repo itself has
// drifted and the fix belongs in the JSON, not here.
test('the real repository conforms', () => {
  assert.deepEqual(checkConformance(repoRoot), [])
})

// MUST CATCH: the nearest real drift — one manifest bumped, two not. This is
// the exact mistake a release makes, and Claude Code keys update checks on the
// version, so a missed bump means users never see the change.
test('a version bumped in one manifest alone is caught', () => {
  const dir = copyRepo()
  const file = path.join(dir, 'plugin.json')
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  // Derived from the real version, never hardcoded: a literal here became the
  // actual version on the first release and the mutation stopped mutating.
  manifest.version = `${manifest.version}-drift`
  fs.writeFileSync(file, JSON.stringify(manifest))
  const problems = checkConformance(dir)
  assert.ok(problems.some((p) => p.includes('disagree on version')), problems.join('\n'))
})

test('a wrong server url is caught in either MCP config', () => {
  for (const target of ['mcp.json', '.mcp.json']) {
    const dir = copyRepo()
    const file = path.join(dir, target)
    const config = JSON.parse(fs.readFileSync(file, 'utf8'))
    config.mcpServers.runner.url = 'https://mcp.runner.now.example.com/'
    fs.writeFileSync(file, JSON.stringify(config))
    const problems = checkConformance(dir)
    assert.ok(problems.some((p) => p.startsWith(target)), `${target}: ${problems.join('\n')}`)
  }
})

test('a header smuggled into an MCP config is caught', () => {
  const dir = copyRepo()
  const file = path.join(dir, 'mcp.json')
  const config = JSON.parse(fs.readFileSync(file, 'utf8'))
  config.mcpServers.runner.headers = { authorization: 'Bearer nope' }
  fs.writeFileSync(file, JSON.stringify(config))
  assert.ok(checkConformance(dir).some((p) => p.includes('headers')))
})

test('a mangled $schema is caught, because clients reject it offline', () => {
  const dir = copyRepo()
  const file = path.join(dir, 'mcp.json')
  const config = JSON.parse(fs.readFileSync(file, 'utf8'))
  config.$schema = 'https://agent-plugins.org/schemas/2.0.0/mcp.schema.json'
  fs.writeFileSync(file, JSON.stringify(config))
  assert.ok(checkConformance(dir).some((p) => p.includes('$schema')))
})

// LIVENESS: pointing the check at an empty directory must fail loudly, never
// report agreement over nothing.
test('an empty directory does not pass', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-plugin-empty-'))
  const problems = checkConformance(dir)
  assert.ok(problems.some((p) => p.includes('scanned zero manifests')), problems.join('\n'))
})
