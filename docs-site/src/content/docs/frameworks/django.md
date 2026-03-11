---
title: Python — Django
description: Add AgentFriendly to a Django app.
---

# Django

The Python SDK's Django adapter integrates as a standard Django middleware class.

## Installation

```bash
pip install agentfriendly[django]
```

## Setup

Add to `settings.py`:

```python
# settings.py
MIDDLEWARE = [
    "agentfriendly.adapters.django.AgentFriendlyMiddleware",
    # ... other middleware
    "django.middleware.common.CommonMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    # ...
]

AGENTFRIENDLY = {
    "detection": {"proactive_markdown": "known"},
    "content": {"markdown": True},
    "access": {
        "agent_types": {"training-crawler": "deny-all"},
        "deny": ["/admin/**"],
    },
}
```

## Accessing Context in Views

```python
from agentfriendly import get_agent_context
from django.http import JsonResponse

def products_view(request):
    ctx = get_agent_context()
    # or: ctx = getattr(request, "agent_context", None)

    products = list(Product.objects.all().values())

    if ctx and ctx.is_agent:
        return JsonResponse({"products": products})

    return JsonResponse({"products": products, "meta": {"total": len(products)}})
```

## Class-Based Views

```python
from django.views import View
from agentfriendly import get_agent_context

class BlogPostView(View):
    def get(self, request, slug):
        ctx = get_agent_context()
        post = get_object_or_404(Post, slug=slug)

        # Django's TemplateResponse — agents receive markdown automatically
        from django.template.response import TemplateResponse
        return TemplateResponse(request, "blog/post.html", {"post": post})
```
