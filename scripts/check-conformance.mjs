// One directory serves three plugin formats, so the same facts live in five
// JSON files: three manifests, two MCP configs, two marketplace files. This
// check is what keeps them in agreement — a drifted copy ships a plugin that
// works in one client and silently misconfigures another.
//
// Exit 0 when every rule below holds; exit 1 with one line per violation.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// No trailing slash: this is the spelling the rest of the product uses
// (cfg.mcpPublicOrigin, and the `claude mcp add` command the first real
// sign-in ran). Both spellings request path '/', so this is consistency, not
// behavior — but one spelling means one string to grep for.
export const SERVER_URL = 'https://mcp.runner.now'
export const PLUGIN_NAME = 'runner'

export function checkConformance(root) {
  const problems = []
  const read = (relative) => {
    const file = path.join(root, relative)
    if (!fs.existsSync(file)) {
      problems.push(`${relative}: missing`)
      return undefined
    }
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (error) {
      problems.push(`${relative}: not valid JSON (${error instanceof Error ? error.message : error})`)
      return undefined
    }
  }

  const manifests = {
    '.claude-plugin/plugin.json': read('.claude-plugin/plugin.json'),
    '.codex-plugin/plugin.json': read('.codex-plugin/plugin.json'),
    'plugin.json': read('plugin.json'),
  }
  const versions = new Set()
  for (const [file, manifest] of Object.entries(manifests)) {
    if (!manifest) continue
    if (manifest.name !== PLUGIN_NAME) problems.push(`${file}: name is '${manifest.name}', not '${PLUGIN_NAME}'`)
    if (typeof manifest.version !== 'string') problems.push(`${file}: no version`)
    else versions.add(manifest.version)
  }
  if (versions.size > 1) {
    problems.push(`manifests disagree on version: ${[...versions].join(' vs ')} — bump all three together`)
  }

  // The Agent Plugins files carry exact $schema identifiers; a client rejects
  // an unknown one without fetching it, so a typo here is a dead plugin.
  const agentManifest = manifests['plugin.json']
  if (agentManifest && agentManifest.$schema !== 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json') {
    problems.push(`plugin.json: $schema is '${agentManifest.$schema}'`)
  }
  const agentMcp = read('mcp.json')
  if (agentMcp) {
    if (agentMcp.$schema !== 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json') {
      problems.push(`mcp.json: $schema is '${agentMcp.$schema}'`)
    }
    const server = agentMcp.mcpServers?.[PLUGIN_NAME]
    if (!server) problems.push(`mcp.json: no '${PLUGIN_NAME}' server`)
    else {
      if (server.type !== 'streamable-http') problems.push(`mcp.json: type is '${server.type}', not 'streamable-http'`)
      if (server.url !== SERVER_URL) problems.push(`mcp.json: url is '${server.url}', not '${SERVER_URL}'`)
      if (server.headers) problems.push('mcp.json: headers are visible package data; carry none')
    }
  }
  const nativeMcp = read('.mcp.json')
  if (nativeMcp) {
    const server = nativeMcp.mcpServers?.[PLUGIN_NAME]
    if (!server) problems.push(`.mcp.json: no '${PLUGIN_NAME}' server`)
    else {
      if (server.type !== 'http') problems.push(`.mcp.json: type is '${server.type}', not 'http'`)
      if (server.url !== SERVER_URL) problems.push(`.mcp.json: url is '${server.url}', not '${SERVER_URL}'`)
      if (server.headers) problems.push('.mcp.json: headers are visible package data; carry none')
      if (server.env) problems.push('.mcp.json: carry no env')
    }
  }

  const claudeMarket = read('.claude-plugin/marketplace.json')
  if (claudeMarket) {
    const list = Array.isArray(claudeMarket.plugins) ? claudeMarket.plugins : []
    if (list.length !== 1 || list[0]?.name !== PLUGIN_NAME) {
      problems.push('.claude-plugin/marketplace.json: must list exactly one plugin, named runner')
    }
  }
  const codexMarket = read('.agents/plugins/marketplace.json')
  if (codexMarket) {
    const list = Array.isArray(codexMarket.plugins) ? codexMarket.plugins : []
    if (list.length !== 1 || list[0]?.name !== PLUGIN_NAME) {
      problems.push('.agents/plugins/marketplace.json: must list exactly one plugin, named runner')
    }
  }

  const skill = path.join(root, 'skills', PLUGIN_NAME, 'SKILL.md')
  if (!fs.existsSync(skill)) problems.push(`skills/${PLUGIN_NAME}/SKILL.md: missing`)
  else {
    const body = fs.readFileSync(skill, 'utf8')
    const match = body.match(/^---\n([\s\S]*?)\n---\n/)
    if (!match) problems.push('SKILL.md: no frontmatter block')
    else if (!/^description:/m.test(match[1])) problems.push('SKILL.md: frontmatter has no description')
  }

  // Liveness: a run that read nothing must not report agreement.
  const scanned = Object.values(manifests).filter(Boolean).length
  if (scanned === 0) problems.push('scanned zero manifests — the check is pointed at the wrong directory')
  return problems
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const problems = checkConformance(root)
  for (const problem of problems) console.error(problem)
  if (problems.length > 0) process.exit(1)
  console.log('conformance: the five JSON files agree')
}
