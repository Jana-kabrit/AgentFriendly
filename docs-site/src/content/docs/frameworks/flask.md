---
title: Python — Flask
description: Add AgentFriendly to a Flask app.
---

# Flask

The Python SDK's Flask adapter uses before/after request hooks.

## Installation

```bash
pip install agentfriendly[flask]
```

## Setup

```python
from flask import Flask
from agentfriendly.adapters.flask import init_app
from agentfriendly import AgentFriendlyConfig, DetectionConfig

app = Flask(__name__)

init_app(
    app,
    config=AgentFriendlyConfig(
        detection=DetectionConfig(proactive_markdown="known"),
    ),
)
```

## Accessing Context in Routes

```python
from flask import Flask, g, jsonify
from agentfriendly import get_agent_context

@app.route("/products")
def products():
    ctx = get_agent_context()
    # or: ctx = g.agent_context

    products = Product.query.all()

    if ctx and ctx.is_agent:
        return jsonify(products=[p.to_dict() for p in products])

    return jsonify(
        products=[p.to_dict() for p in products],
        meta={"total": len(products)},
    )
```

## HTML → Markdown

```python
@app.route("/blog/<slug>")
def blog_post(slug):
    post = Post.query.filter_by(slug=slug).first_or_404()
    # Agents receive markdown; humans receive HTML
    return render_template("blog/post.html", post=post)
```
