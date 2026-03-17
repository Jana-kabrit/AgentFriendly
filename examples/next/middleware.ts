/**
 * Next.js middleware — runs on every request before routing.
 *
 * @agentfriendly processes agent detection, discovery file serving,
 * access control, and monetization here. HTML→markdown conversion
 * happens in the route handler via `withAgentFriendly`.
 */
import { createAgentFriendlyMiddleware } from "@agentfriendly/next";

export const middleware = createAgentFriendlyMiddleware({
  detection: {
    proactiveMarkdown: "known",
  },
  content: {
    markdown: true,
    signals: {
      "ai-train": false,
      "ai-input": true,
      search: true,
    },
  },
  analytics: {
    enabled: true,
    storage: "sqlite",
  },
  access: {
    deny: ["/admin/**", "/internal/**"],
    agentTypes: {
      "training-crawler": "allow-public",
    },
  },
  debug: process.env.NODE_ENV === "development",
});

export const config = {
  matcher: [
    // Run on all routes except Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
