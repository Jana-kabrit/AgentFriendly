---
title: Python — FastAPI
description: Add AgentFriendly to a FastAPI app.
---

# FastAPI

The Python SDK's FastAPI adapter integrates as a Starlette ASGI middleware.

## Installation

```bash
pip install agentfriendly[fastapi]
```

## Setup

```python
from fastapi import FastAPI
from agentfriendly.adapters.fastapi import AgentFriendlyMiddleware
from agentfriendly import AgentFriendlyConfig, DetectionConfig, ContentConfig, AccessConfig
from agentfriendly.config import AgentTypePolicy

app = FastAPI()

app.add_middleware(
    AgentFriendlyMiddleware,
    config=AgentFriendlyConfig(
        detection=DetectionConfig(proactive_markdown="known"),
        content=ContentConfig(markdown=True),
        access=AccessConfig(
            agent_types={"training-crawler": "deny-all"},
        ),
    ),
)
```

## Accessing Context in Routes

```python
from fastapi import FastAPI, Request
from agentfriendly import get_agent_context

@app.get("/products")
async def list_products(request: Request):
    ctx = get_agent_context()
    # or: ctx = request.state.agent_context

    products = await db.products.find_all()

    if ctx and ctx.is_agent:
        # Return minimal JSON for agents
        return {"products": products}

    # Full response with metadata for humans
    return {"products": products, "meta": {"total": len(products)}}
```

## HTML → Markdown

When a known agent requests an HTML endpoint, the middleware intercepts the response and converts it:

```python
from fastapi.responses import HTMLResponse

@app.get("/blog/{slug}")
async def blog_post(slug: str):
    post = await db.posts.find(slug)
    # Agents receive markdown; humans receive HTML
    return HTMLResponse(f"<html><body><article>{post.html}</article></body></html>")
```

## Environment Variables

```bash
AGENTFRIENDLY_DEBUG=true          # Enable debug headers
AGENTFRIENDLY_TOKEN_SECRET=...    # Multi-tenancy token secret
```

## Full Example

```python
from fastapi import FastAPI
from agentfriendly.adapters.fastapi import AgentFriendlyMiddleware
from agentfriendly import AgentFriendlyConfig, DetectionConfig

app = FastAPI(title="My Agent-Friendly API")

app.add_middleware(
    AgentFriendlyMiddleware,
    config=AgentFriendlyConfig(
        detection=DetectionConfig(proactive_markdown="known"),
    ),
)

@app.get("/")
async def root():
    return {"message": "Hello, agent!"}
```
