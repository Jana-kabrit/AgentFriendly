"""
Layer 2 — HTML to Markdown Conversion

Uses BeautifulSoup4 + markdownify for HTML→Markdown conversion.
Falls back to simple regex stripping when bs4 is not installed.

Mirrors packages/core/src/content/html-to-markdown.ts
"""

from __future__ import annotations

from dataclasses import dataclass

DEFAULT_STRIP_SELECTORS = [
    "nav",
    "footer",
    "aside",
    "script",
    "style",
    "noscript",
    "iframe",
    "header nav",
    ".ads",
    ".advertisement",
    ".cookie-banner",
    ".sidebar",
]


@dataclass(frozen=True)
class MarkdownConversionResult:
    markdown: str
    title: str
    estimated_tokens: int
    used_readability: bool


def estimate_token_count(text: str) -> int:
    """Estimate token count using the ~4 chars/token heuristic."""
    return max(1, len(text) // 4)


def html_to_markdown(
    html: str,
    url: str = "",
    additional_strip_selectors: list[str] | None = None,
) -> MarkdownConversionResult:
    """
    Convert HTML to clean markdown.

    Uses BeautifulSoup4 + markdownify when available.
    Falls back to simple regex-based stripping for environments without bs4.
    """
    try:
        return _bs4_convert(html, additional_strip_selectors or [])
    except ImportError:
        return _simple_fallback(html)


def _bs4_convert(
    html: str,
    additional_selectors: list[str],
) -> MarkdownConversionResult:
    """Full conversion using BeautifulSoup4 + markdownify."""
    from bs4 import BeautifulSoup  # type: ignore[import-untyped]
    import markdownify  # type: ignore[import-untyped]

    soup = BeautifulSoup(html, "lxml")

    # Extract title before stripping
    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else ""

    # Strip noise selectors
    all_selectors = DEFAULT_STRIP_SELECTORS + additional_selectors
    for selector in all_selectors:
        for tag in soup.select(selector):
            tag.decompose()

    # Find the main content (prefer <main> or <article>)
    main = soup.find("main") or soup.find("article") or soup.find("body") or soup

    markdown: str = markdownify.markdownify(
        str(main),
        heading_style="ATX",
        bullets="-",
        strip=["script", "style", "iframe"],
    )

    # Clean up excessive whitespace
    import re

    markdown = re.sub(r"\n{3,}", "\n\n", markdown).strip()

    return MarkdownConversionResult(
        markdown=markdown,
        title=title,
        estimated_tokens=estimate_token_count(markdown),
        used_readability=True,
    )


def _simple_fallback(html: str) -> MarkdownConversionResult:
    """Fallback: regex-based HTML stripping without bs4."""
    import re

    text = html
    # Remove script/style/nav/footer blocks
    for tag in ("script", "style", "nav", "footer", "aside", "header"):
        text = re.sub(
            rf"<{tag}\b[^>]*>[\s\S]*?</{tag}>", "", text, flags=re.IGNORECASE
        )

    # Basic structural conversions
    text = re.sub(r"<h1\b[^>]*>(.*?)</h1>", r"\n# \1\n", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<h2\b[^>]*>(.*?)</h2>", r"\n## \1\n", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<h3\b[^>]*>(.*?)</h3>", r"\n### \1\n", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<strong\b[^>]*>(.*?)</strong>", r"**\1**", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<b\b[^>]*>(.*?)</b>", r"**\1**", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<em\b[^>]*>(.*?)</em>", r"_\1_", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<code\b[^>]*>(.*?)</code>", r"`\1`", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'<a\b[^>]*href="([^"]*)"[^>]*>(.*?)</a>', r"[\2](\1)", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<p\b[^>]*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<li\b[^>]*>", "\n- ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)  # strip remaining tags

    # HTML entities
    for entity, char in [
        ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"),
        ("&quot;", '"'), ("&#39;", "'"), ("&nbsp;", " "),
    ]:
        text = text.replace(entity, char)

    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    return MarkdownConversionResult(
        markdown=text,
        title="",
        estimated_tokens=estimate_token_count(text),
        used_readability=False,
    )
