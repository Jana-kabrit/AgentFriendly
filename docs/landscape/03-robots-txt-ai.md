# robots.txt for AI Crawlers

## What It Is

`robots.txt` is a text file at `https://yourdomain.com/robots.txt` that tells web crawlers which paths they can and cannot access. It has been part of the web since 1994 (the Robots Exclusion Standard).

In 2023–2026, AI companies began publishing user-agent strings for their crawlers, making it possible to control AI access specifically via `robots.txt`.

## The Full List of Known AI User-Agents (March 2026)

### Training Crawlers (absorb content into models — no attribution)

| User-Agent         | Operator        | Notes                              |
| ------------------ | --------------- | ---------------------------------- |
| GPTBot             | OpenAI          | Training crawler for GPT models    |
| ClaudeBot          | Anthropic       | Training crawler for Claude models |
| Google-Extended    | Google          | Training crawler for Gemini models |
| CCBot              | Common Crawl    | Training data for many models      |
| Bytespider         | ByteDance       | Training for TikTok/Douyin AI      |
| anthropic-ai       | Anthropic       | Older training crawler UA          |
| Meta-ExternalAgent | Meta            | Training for Llama models          |
| Amazonbot          | Amazon          | Training for Alexa/Titan           |
| PetalBot           | Huawei          | Search/AI training                 |
| Diffbot            | Diffbot         | AI training and knowledge graphs   |
| AI2Bot             | Allen Institute | Academic AI research               |
| cohere-ai          | Cohere          | Training for Cohere models         |
| Applebot-Extended  | Apple           | Training for Apple AI features     |

### Citation/Search Crawlers (quote your content with source links — drive traffic)

| User-Agent       | Operator   | Notes                              |
| ---------------- | ---------- | ---------------------------------- |
| OAI-SearchBot    | OpenAI     | SearchGPT/ChatGPT search citations |
| ChatGPT-User     | OpenAI     | ChatGPT browsing plugin            |
| Claude-SearchBot | Anthropic  | Claude web search citations        |
| Claude-Web       | Anthropic  | Claude browsing capability         |
| PerplexityBot    | Perplexity | Perplexity search citations        |
| YouBot           | You.com    | You.com AI search                  |
| DuckDuckBot      | DuckDuckGo | DuckDuckGo AI search               |
| DuckAssistBot    | DuckDuckGo | DuckAssist AI answers              |
| Applebot         | Apple      | Apple search and Siri              |
| Bingbot          | Microsoft  | Bing search (used by Copilot)      |

### Interactive/Browser Agents (executing tasks on behalf of users)

| User-Agent             | Operator | Notes                           |
| ---------------------- | -------- | ------------------------------- |
| GoogleAgent-URLContext | Google   | Gemini CLI web fetching         |
| axios/\*               | Various  | Claude Code WebFetch uses axios |
| colly                  | Various  | Windsurf uses colly scraper     |
| Python-urllib/\*       | Various  | Common in automated agents      |

## How to Use robots.txt for AI Control

```
# Block all AI training crawlers (they take your content without attribution)
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Meta-ExternalAgent
Disallow: /

User-agent: anthropic-ai
Disallow: /

# Allow citation crawlers (they quote you with links and drive traffic)
User-agent: ChatGPT-User
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: OAI-SearchBot
Allow: /
```

## The Trade-Off: Training vs. Citation

**Training crawlers** (GPTBot, ClaudeBot) absorb your content into model training datasets. Your content improves the model but you receive no attribution, no traffic, and no revenue. Blocking these is common and has no impact on your search rankings.

**Citation crawlers** (ChatGPT-User, PerplexityBot, Claude-Web) fetch your content in real time when a user asks a question. The AI cites your site as a source, driving referral traffic. Blocking these reduces your visibility in AI-generated search results.

Blocking `Google-Extended` does **not** affect Google Search rankings — it only affects Gemini training.

## Important Limitations

- `robots.txt` is a courtesy protocol — crawlers can ignore it. Legitimate AI companies honor it; malicious scrapers may not.
- Changes take 24–48 hours to take effect as crawlers check `robots.txt` periodically.
- You cannot set per-path rules per user-agent in a nuanced way without listing each path explicitly.

## How `@agentfriendly` Differs

`robots.txt` is static and only controls training/indexing crawlers — it has no effect on interactive agents making real-time requests.

`@agentfriendly` **auto-generates the AI section of `robots.txt`** from your access control configuration:

```typescript
// agentfriendly.config.ts
export default {
  access: {
    deny: ["/admin/**", "/billing/**"],
    allow: ["/docs/**"],
    agentTypes: {
      "training-crawler": "deny-all", // block training crawlers from everything
      "citation-bot": "allow-public", // allow citation bots to public content
    },
  },
};
```

The SDK generates the `robots.txt` AI directives automatically and keeps them in sync with your access control rules. It also goes beyond `robots.txt` by enforcing access control in real time (HTTP 403 for denied paths, regardless of whether the crawler honors `robots.txt`).
