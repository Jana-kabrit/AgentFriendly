# Layer 6: Tool Registry

The tool registry allows websites to expose structured, callable functions to AI agents. This is the mechanism that transforms your SaaS platform from a website agents can _read_ into a platform agents can _use_.

## The Core Problem

Without a tool registry, an agent wanting to "create a new project" in your SaaS must:

1. Navigate to `/projects/new`
2. Detect the form fields
3. Fill them in
4. Submit the form
5. Handle CSRF tokens, JavaScript-rendered forms, redirects

With a registered tool, the agent does:

```json
POST /agent/tools/createProject
{ "name": "My Project", "template": "blank" }
```

---

## Tool Registration

Tools are registered at application startup using `registerTool()`:

```typescript
import { registerTool } from "@agentfriendly/core";

registerTool({
  name: "createProject",
  version: "1.0.0",
  description: "Create a new project in the workspace",
  schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Project name", maxLength: 100 },
      template: { type: "string", enum: ["blank", "starter", "enterprise"] },
      teamId: { type: "string", description: "Team to create the project in" },
    },
    required: ["name"],
  },
  handler: async (input, context) => {
    const project = await db.projects.create({
      name: input.name,
      template: input.template ?? "blank",
      teamId: context.tenantContext?.tenantId ?? input.teamId,
    });
    return { projectId: project.id, url: `/projects/${project.id}` };
  },
});
```

---

## Tool Invocation

Agents invoke tools via `POST /agent/tools/:toolName`:

```http
POST /agent/tools/createProject
Authorization: Bearer <agent-session-token>
Content-Type: application/json

{ "name": "My Project", "template": "starter" }
```

The registry:

1. Looks up the tool by name (and optionally version via `?version=1.0.0`).
2. Validates input against the JSON Schema.
3. Checks access control (tier requirements, operator allowlist).
4. Invokes `handler(input, agentContext)`.
5. Returns the handler's return value as JSON.

```http
HTTP/1.1 200 OK
Content-Type: application/json

{ "projectId": "proj_abc123", "url": "/projects/proj_abc123" }
```

---

## Semantic Versioning

Tool versions follow semver. The registry supports multiple versions of the same tool simultaneously, enabling backwards-compatible evolution:

```typescript
registerTool({ name: "searchProducts", version: "1.0.0", ... });
registerTool({ name: "searchProducts", version: "2.0.0", ... }); // adds "priceRange" param
```

Version resolution:

- `?version=2.0.0` → exact match.
- `?version=1` → highest `1.x.x` version.
- No version → latest registered version.

The tool manifest at `/.well-known/agent-tools.json` lists all available versions.

**Tool versioning is decoupled from SDK versioning** (ADR-006). Bumping a tool version does not require bumping the `@agentfriendly` package version.

---

## Access Control per Tool

Tools can restrict which agent tiers or operators can invoke them:

```typescript
registerTool({
  name: "deleteAccount",
  requiredTier: "verified-agent",        // only cryptographically verified agents
  allowedOperators: ["internal-agent"],  // further restrict by operator
  ...
});
```

---

## Tool Pricing

Tools can have individual pricing policies (evaluated by Layer 7 — Monetization):

```typescript
registerTool({
  name: "generateReport",
  pricing: {
    model: "per-call",
    amount: 0.01,   // $0.01 USDC per report generation
    currency: "USDC",
  },
  ...
});
```

When a priced tool is invoked, the monetization layer intercepts the request _before_ the tool handler is called.

---

## Async Tasks (MODE3)

Some operations take longer than a single HTTP request/response cycle (e.g., generating a large report, training a model, running a batch job). The registry supports async tasks via `registerTask()`:

```typescript
import { registerTask } from "@agentfriendly/core";

registerTask({
  name: "generateMonthlyReport",
  description: "Generate the monthly usage report (takes 30–120 seconds)",
  schema: { ... },
  handler: async (input, context) => {
    // Long-running operation
    const report = await generateReport(input.month, input.year);
    return { reportUrl: report.url, rowCount: report.rowCount };
  },
});
```

### Async Task Flow

```
Agent → POST /agent/tasks/generateMonthlyReport
        { "month": 2, "year": 2024 }

Server → 202 Accepted
         { "taskId": "task_xyz789", "pollUrl": "/agent/tasks/task_xyz789" }

Agent → GET /agent/tasks/task_xyz789  (polls periodically)

Server → 200 OK (while running)
         { "taskId": "task_xyz789", "status": "running", "progress": 45 }

         200 OK (when complete)
         { "taskId": "task_xyz789", "status": "complete",
           "result": { "reportUrl": "...", "rowCount": 5432 } }
```

The task queue is in-memory by default. For production use with multiple workers, inject a distributed task backend.

---

## Tool Handler Context

Every tool handler receives the full `AgentContext` as its second argument:

```typescript
handler: async (input, context) => {
  context.tier; // "verified-agent"
  context.agentOperator; // "openai"
  context.verifiedIdentity; // { agentId, operator, keyId, verifiedAt }
  context.tenantContext; // { userId, tenantId, scopes }
};
```

This enables tools to behave differently based on who is calling them.
