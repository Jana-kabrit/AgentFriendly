/**
 * Home page — served as HTML to humans, auto-converted to markdown for agents.
 * The `withAgentFriendly` HOC in the route handler performs the conversion.
 */
export default function HomePage() {
  return (
    <main>
      <h1>AgentFriendly Example</h1>
      <p>
        This page is served as clean, structured markdown to AI agents, and as a normal web page to
        human visitors.
      </p>

      <h2>What this SDK does</h2>
      <ul>
        <li>Detects whether the visitor is an AI agent or a human browser</li>
        <li>Serves optimized markdown content to agents (reduces token cost by ~70%)</li>
        <li>
          Exposes a machine-readable tool manifest at <code>/.well-known/agent.json</code>
        </li>
        <li>Tracks both human and agent traffic with full analytics</li>
        <li>Enforces access control and rate limits for agent traffic</li>
        <li>Supports x402 micropayments for premium agent API endpoints</li>
        <li>Enables multi-tenant agent sessions for SaaS platforms</li>
      </ul>

      <h2>Getting Started</h2>
      <p>
        Install with: <code>pnpm add @agentfriendly/next</code>
      </p>
    </main>
  );
}
