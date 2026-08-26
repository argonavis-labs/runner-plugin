# Runner

Runner for your coding agent: your orgs, your Projects, and the tools to work
with them. Installing this plugin connects your agent to the Runner MCP server
at `https://mcp.runner.now` and adds the `runner` skill. Sign-in happens in
your browser on first use.

## Install

**Claude Code**

```
/plugin marketplace add argonavis-labs/runner-plugin
/plugin install runner@runner
```

**Codex**

```
codex plugin marketplace add argonavis-labs/runner-plugin
```

**Any Agent Plugins 1.0 client** (Cursor, Copilot, Kiro, VS Code): point it at
this repository. The standard layout (`plugin.json`, `mcp.json`, `skills/`)
sits at the root.

**No plugin support?** The server works on its own:

```
claude mcp add --transport http runner https://mcp.runner.now
```
