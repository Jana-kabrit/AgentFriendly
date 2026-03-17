/**
 * Express.js example server demonstrating @agentfriendly/express.
 *
 * Run with: npx tsx watch src/server.ts
 *
 * Try these requests:
 *   curl http://localhost:3000/
 *   curl -H "User-Agent: GPTBot/1.0" http://localhost:3000/
 *   curl -H "Accept: text/markdown" http://localhost:3000/docs
 *   curl http://localhost:3000/.well-known/agent.json
 *   curl http://localhost:3000/llms.txt
 */
import express from "express";

import { createAgentFriendlyMiddleware } from "@agentfriendly/express";
import { getAgentContext } from "@agentfriendly/core";

const app = express();

// Apply the AgentFriendly middleware to all routes
app.use(
  createAgentFriendlyMiddleware({
    detection: {
      proactiveMarkdown: "known",
    },
    content: {
      markdown: true,
      signals: { "ai-train": false, "ai-input": true, search: true },
    },
    analytics: {
      enabled: true,
      storage: "sqlite",
    },
    access: {
      agentTypes: {
        "training-crawler": "allow-public",
      },
    },
    debug: process.env.NODE_ENV !== "production",
  }),
);

app.get("/", (_req, res) => {
  const ctx = getAgentContext();
  const isAgent = ctx?.isAgent ?? false;

  // The middleware will automatically convert this HTML to markdown
  // if the request is from a known agent
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <html>
      <head><title>AgentFriendly Express Example</title></head>
      <body>
        <h1>Welcome to the AgentFriendly Express Example</h1>
        <p>This response is ${isAgent ? "from an AI agent" : "from a human browser"}.</p>
        <p>The SDK automatically converts this HTML to clean markdown for AI agents.</p>
        <nav>
          <a href="/docs">Documentation</a>
          <a href="/api/status">API Status</a>
        </nav>
        <footer>Powered by @agentfriendly</footer>
      </body>
    </html>
  `);
});

app.get("/docs", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <html>
      <body>
        <h1>Documentation</h1>
        <p>This is the documentation page. For agents, this is served as clean markdown.</p>
        <h2>Getting Started</h2>
        <ol>
          <li>Install the SDK: <code>npm install @agentfriendly/express</code></li>
          <li>Apply the middleware to your Express app</li>
          <li>That's it! Your site is now agent-friendly.</li>
        </ol>
      </body>
    </html>
  `);
});

app.get("/api/status", (_req, res) => {
  const ctx = getAgentContext();
  res.json({
    status: "ok",
    agentDetected: ctx?.isAgent ?? false,
    tier: ctx?.tier ?? "human",
    timestamp: new Date().toISOString(),
  });
});

const PORT = Number(process.env.PORT ?? "3001");
app.listen(PORT, () => {
  console.log(`AgentFriendly Express example running at http://localhost:${PORT}`);
  console.log(`Try: curl -H "User-Agent: GPTBot/1.0" http://localhost:${PORT}/`);
});
