/**
 * Pre-built AgentRequest objects for use in tests.
 */
import { HEADERS } from "./http-headers.js";

import type { AgentRequest } from "@agentfriendly/core";

export const REQUESTS = {
  humanBrowser: {
    method: "GET",
    url: "https://example.com/",
    path: "/",
    headers: HEADERS.fullBrowser,
    body: null,
    query: {},
    ip: "203.0.113.1",
  } satisfies AgentRequest,

  gptBotRoot: {
    method: "GET",
    url: "https://example.com/",
    path: "/",
    headers: HEADERS.gptBot,
    body: null,
    query: {},
    ip: "198.51.100.1",
  } satisfies AgentRequest,

  gptBotMarkdownRequest: {
    method: "GET",
    url: "https://example.com/docs",
    path: "/docs",
    headers: HEADERS.agentMarkdownRequest,
    body: null,
    query: {},
    ip: "198.51.100.1",
  } satisfies AgentRequest,

  curlRequest: {
    method: "GET",
    url: "https://example.com/",
    path: "/",
    headers: HEADERS.curlLike,
    body: null,
    query: {},
    ip: null,
  } satisfies AgentRequest,

  llmsTxtRequest: {
    method: "GET",
    url: "https://example.com/llms.txt",
    path: "/llms.txt",
    headers: HEADERS.gptBot,
    body: null,
    query: {},
    ip: null,
  } satisfies AgentRequest,

  agentManifestRequest: {
    method: "GET",
    url: "https://example.com/.well-known/agent.json",
    path: "/.well-known/agent.json",
    headers: HEADERS.agentJsonRequest,
    body: null,
    query: {},
    ip: null,
  } satisfies AgentRequest,
} as const;
