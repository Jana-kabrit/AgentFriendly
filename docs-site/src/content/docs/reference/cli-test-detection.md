---
title: agentfriendly test-detection
description: Simulate the detection pipeline for a User-Agent string.
---

# agentfriendly test-detection

Runs the AgentFriendly detection pipeline locally and shows the resolved TrustTier for a given User-Agent string and Accept header — without starting a server.

## Usage

```bash
agentfriendly test-detection [options]
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--ua <string>` | Chrome UA | User-Agent string to simulate |
| `--accept <string>` | `text/html,*/*` | Accept header to simulate |
| `--verbose` | false | Show full pipeline trace |

## Examples

```bash
# Test a known agent
agentfriendly test-detection --ua "GPTBot/1.0"

# Test an agent requesting markdown
agentfriendly test-detection \
  --ua "ClaudeBot/1.0" \
  --accept "text/markdown, text/html;q=0.5"

# Test a human browser
agentfriendly test-detection \
  --ua "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36"

# Show full pipeline trace
agentfriendly test-detection --ua "GPTBot/1.0" --verbose
```

## Example Output

```
  🤖 Detection Pipeline Simulator
  ──────────────────────────────────────────────

    User-Agent              GPTBot/1.0
    Accept                  text/markdown, text/html;q=0.5

  Resolved: [known-agent]

    is_agent                true
    tier                    known-agent
    signals                 ua-database, accept-header

  UA Database match:
    agent_name              GPTBot
    operator                OpenAI
    category                training-crawler
    verification            not supported

  ✓ Known agent detected — SDK will serve markdown and apply agent policies.
```
