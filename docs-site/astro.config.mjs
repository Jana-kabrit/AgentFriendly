import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [
    starlight({
      title: "AgentFriendly",
      description:
        "Make your website agent-friendly — detection, markdown serving, tool registry, x402 payments, and multi-tenancy for AI agents.",
      logo: {
        alt: "AgentFriendly",
        src: "./src/assets/logo.png",
        replacesTitle: false,
      },
      favicon: "/favicon.png",
      social: {
        github: "https://github.com/Jana-kabrit/AgentFriendly",
      },
      editLink: {
        baseUrl: "https://github.com/Jana-kabrit/AgentFriendly/edit/main/docs-site/",
      },
      customCss: ["./src/styles/custom.css"],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Introduction", link: "/guides/introduction" },
            { label: "Quick Start", link: "/guides/quick-start" },
            { label: "How It Works", link: "/guides/how-it-works" },
            { label: "Installation", link: "/guides/installation" },
          ],
        },
        {
          label: "Framework Guides",
          items: [
            { label: "Next.js", link: "/frameworks/nextjs" },
            { label: "Express.js", link: "/frameworks/express" },
            { label: "Hono / Cloudflare Workers", link: "/frameworks/hono" },
            { label: "Nuxt 3", link: "/frameworks/nuxt" },
            { label: "Astro", link: "/frameworks/astro" },
            { label: "Python — FastAPI", link: "/frameworks/fastapi" },
            { label: "Python — Django", link: "/frameworks/django" },
            { label: "Python — Flask", link: "/frameworks/flask" },
          ],
        },
        {
          label: "Layer Guides",
          items: [
            { label: "Layer 0: Detection", link: "/layers/detection" },
            { label: "Layer 1: Discovery", link: "/layers/discovery" },
            { label: "Layer 2: Content Negotiation", link: "/layers/content" },
            { label: "Layer 3: Analytics", link: "/layers/analytics" },
            { label: "Layer 4: Access Control", link: "/layers/access-control" },
            { label: "Layer 5: Privacy & PII Masking", link: "/layers/privacy" },
            { label: "Layer 6: Tool Registry", link: "/layers/tools" },
            { label: "Layer 7: x402 Monetization", link: "/layers/monetization" },
            { label: "Layer 8: Multi-Tenancy", link: "/layers/multi-tenancy" },
          ],
        },
        {
          label: "CLI",
          items: [
            { label: "agentfriendly init", link: "/reference/cli-init" },
            { label: "agentfriendly validate", link: "/reference/cli-validate" },
            { label: "agentfriendly test-detection", link: "/reference/cli-test-detection" },
            { label: "agentfriendly preview", link: "/reference/cli-preview" },
          ],
        },
        {
          label: "API Reference",
          items: [
            { label: "AgentFriendlyConfig", link: "/reference/config" },
            { label: "AgentContext", link: "/reference/agent-context" },
            { label: "TrustTier", link: "/reference/trust-tier" },
            { label: "ToolDefinition", link: "/reference/tool-definition" },
          ],
        },
      ],
    }),
  ],
});
