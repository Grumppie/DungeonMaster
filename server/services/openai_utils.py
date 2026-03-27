from __future__ import annotations

from typing import Any

from openai import OpenAI


def build_openai_client(api_key: str) -> OpenAI | None:
    if not api_key:
        return None
    return OpenAI(api_key=api_key)


def extract_response_text(payload: Any) -> str:
    output_text = getattr(payload, "output_text", None)
    if output_text:
        return output_text.strip()

    texts: list[str] = []
    for item in getattr(payload, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            text = getattr(content, "text", None)
            if text:
                texts.append(text)
    return "\n".join(texts).strip()
