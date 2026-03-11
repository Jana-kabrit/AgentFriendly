/**
 * Canonical HTTP header sets for testing.
 */
export const HEADERS = {
  /**
   * A complete set of real browser request headers.
   * These should always resolve to tier = "human".
   */
  fullBrowser: {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "gzip, deflate, br",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    cookie: "session=abc123; csrftoken=xyz",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "navigate",
    "sec-fetch-user": "?1",
    "sec-fetch-dest": "document",
    referer: "https://example.com/",
  },

  /**
   * Minimal headers sent by GPTBot.
   */
  gptBot: {
    "user-agent": "GPTBot/1.0",
    accept: "text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8",
    "accept-encoding": "gzip",
  },

  /**
   * Agent explicitly requesting markdown.
   */
  agentMarkdownRequest: {
    "user-agent": "GPTBot/1.0",
    accept: "text/markdown, text/html;q=0.5",
  },

  /**
   * Agent requesting application/agent+json.
   */
  agentJsonRequest: {
    "user-agent": "GPTBot/1.0",
    accept: "application/agent+json, */*;q=0.5",
  },

  /**
   * Minimal curl-like headers — will trigger heuristic detection.
   */
  curlLike: {
    "user-agent": "curl/8.4.0",
    accept: "*/*",
  },

  /**
   * Python requests headers — triggers heuristic detection.
   */
  pythonRequests: {
    "user-agent": "python-requests/2.31.0",
    accept: "*/*",
    "accept-encoding": "gzip, deflate",
    connection: "keep-alive",
  },
} as const;
