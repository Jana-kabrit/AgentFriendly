/**
 * User-Agent strings for use in tests across the @agentfriendly monorepo.
 */
export const UA = {
  // ----- Humans -----
  chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  safari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",

  // ----- Training Crawlers -----
  gptBot: "GPTBot/1.0",
  claudeBot: "ClaudeBot/1.0 (+https://claude.ai/bot)",
  googleExtended: "Google-Extended",
  ccBot: "CCBot/2.0 (https://commoncrawl.org/faq/)",
  anthropicAi: "anthropic-ai",
  cohere: "cohere-ai",

  // ----- Search Bots -----
  oaiSearchBot: "OAI-SearchBot/1.0",
  chatGptUser: "ChatGPT-User/1.0",
  perplexityBot: "PerplexityBot/1.0",

  // ----- Interactive / Browser Agents -----
  googleAgentUrlContext: "GoogleAgent-URLContext",

  // ----- Unknown / Minimal -----
  curl: "curl/8.4.0",
  python: "python-requests/2.31.0",
  httpie: "HTTPie/3.2.0",
} as const;

export type KnownUA = (typeof UA)[keyof typeof UA];
