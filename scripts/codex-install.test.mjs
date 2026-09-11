import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('Codex installs Runner from its marketplace', (t) => {
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-codex-'))
  t.after(() => fs.rmSync(configDir, { recursive: true, force: true }))
  const run = (...args) => {
    const result = spawnSync('codex', args, {
      cwd: repoRoot,
      env: { ...process.env, CODEX_HOME: configDir },
      encoding: 'utf8',
      timeout: 60_000,
    })
    assert.equal(result.status, 0, result.error?.message ?? (result.stderr || result.stdout))
    return JSON.parse(result.stdout)
  }

  run('plugin', 'marketplace', 'add', repoRoot, '--json')
  const { installedPath } = run('plugin', 'add', 'runner@runner', '--json')
  const { installed } = run('plugin', 'list', '--marketplace', 'runner', '--json')
  assert.equal(installed.length, 1)
  assert.equal(installed[0].pluginId, 'runner@runner')
  assert.equal(installed[0].enabled, true)
  assert.ok(fs.existsSync(path.join(installedPath, 'skills', 'runner', 'SKILL.md')))

  const server = run('mcp', 'list', '--json').find((entry) => entry.name === 'runner')
  assert.equal(server?.enabled, true)
  assert.equal(server?.transport.type, 'streamable_http')
  assert.equal(server?.transport.url, 'https://mcp.runner.now')
})
