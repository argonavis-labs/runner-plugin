---
name: runner
description: Work with the user's Runner workspace — orgs, Projects, and the
  Runner control plane. Use when a task involves the user's Runner account.
---

Runner is the user's Runner workspace: the orgs they belong to and the
Projects inside each.

1. Call `list_orgs` first. It returns every org the user belongs to, their
   role in each, and the Projects they reach. It is the only tool that takes
   no org, because it is how you learn which org names exist.
2. Every later Runner tool names one org. Never guess an org name; take it
   from `list_orgs`.
3. If a call answers 401, the user's sign-in lapsed. Tell them to run the
   client's MCP authentication step again; do not retry the call.
4. An org the user joined in the last 30 seconds can be missing from
   `list_orgs`. If the user insists an org exists, call it again.
