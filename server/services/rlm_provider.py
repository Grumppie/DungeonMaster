from __future__ import annotations

import re
import time
from typing import Any

from server.config import Settings
from server.services.corpus import CorpusManager

try:
    from rlm import RLM
except ImportError:  # pragma: no cover - handled at runtime
    RLM = None


def search_pages(pages: list[dict[str, Any]], query: str, limit: int = 5) -> list[dict[str, Any]]:
    terms = [term for term in re.findall(r"[a-zA-Z0-9']+", query.lower()) if len(term) > 2]
    scored: list[dict[str, Any]] = []
    for page in pages:
        haystack = f"{page.get('label', '')}\n{page.get('text', '')}".lower()
        score = sum(3 if term in (page.get("label", "").lower()) else 1 for term in terms if term in haystack)
        if score > 0:
            scored.append(
                {
                    "label": page.get("label"),
                    "page_number": page.get("page_number"),
                    "source": page.get("source"),
                    "score": score,
                    "text": page.get("text", "")[:1800],
                }
            )
    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored[:limit]


class RlmMemoryProvider:
    def __init__(self, settings: Settings, corpus_manager: CorpusManager):
        self.settings = settings
        self.corpus_manager = corpus_manager

    def reset(self, session_id: str) -> None:
        _ = session_id

    def answer(
        self,
        question: str,
        session_state: dict[str, Any] | None,
        logs: list[dict[str, Any]] | None,
        session_id: str,
    ) -> dict[str, Any]:
        _ = session_id
        started = time.perf_counter()
        if not self.settings.openai_api_key:
            return {
                "mode": "rlm",
                "answer": "OpenAI API key is missing, so the RLM backend is unavailable.",
                "latencyMs": round((time.perf_counter() - started) * 1000, 1),
                "error": "missing_openai_key",
            }
        if RLM is None:
            return {
                "mode": "rlm",
                "answer": "The rlms package is not installed, so the RLM backend is unavailable.",
                "latencyMs": round((time.perf_counter() - started) * 1000, 1),
                "error": "missing_rlm_package",
            }

        rlm = RLM(
            backend="openai",
            backend_kwargs={
                "api_key": self.settings.openai_api_key,
                "model_name": self.settings.openai_model,
            },
            environment="local",
            persistent=False,
            compaction=False,
            max_depth=1,
            max_iterations=6,
            custom_tools={"search_pages": search_pages},
            verbose=False,
        )
        rulebook_payload = self._select_rulebook_payload(question)
        prompt = {
            "rulebook": rulebook_payload,
            "question": question,
            "session_state": session_state or {},
            "recent_logs": (logs or [])[:12],
        }
        root_prompt = (
            "You are answering a strict D&D 5e 2014 question. The Python variable `context` is a dictionary "
            "with keys `rulebook`, `question`, `session_state`, and `recent_logs`. Use the tool "
            "`search_pages(pages, query, limit)` before answering so the answer is grounded in actual loaded pages. "
            "If the question mentions Alden, Nyra, the duel, or this demo, search `context['rulebook']['supporting_pages']` first. "
            "For broader rules questions, search `context['rulebook']['primary_pages']`. "
            "Answer only from that material and the explicit state/log payload. Cite page numbers or labels when possible. "
            "Your final output must be the literal final answer text, not a variable name or placeholder."
        )
        result = rlm.completion(prompt=prompt, root_prompt=root_prompt)
        answer = self._normalize_answer(getattr(result, "response", ""))
        if self._looks_like_placeholder(answer):
            retry = rlm.completion(
                prompt=prompt,
                root_prompt=root_prompt
                + " Your previous response was malformed. Return only the final prose answer text now.",
            )
            answer = self._normalize_answer(getattr(retry, "response", "")) or answer
        return {
            "mode": "rlm",
            "answer": answer,
            "latencyMs": round((time.perf_counter() - started) * 1000, 1),
            "executionSeconds": round(float(getattr(result, "execution_time", 0.0)), 3),
            "metadata": {
                "rootModel": getattr(result, "root_model", self.settings.openai_model),
                "persistentSession": False,
            },
        }

    def close(self) -> None:
        return None

    def _normalize_answer(self, answer: str) -> str:
        cleaned = answer.strip()
        whole_final = re.fullmatch(r'FINAL\((.*)\)', cleaned, flags=re.DOTALL)
        if whole_final:
            cleaned = whole_final.group(1).strip()
        else:
            cleaned = re.sub(r"\n?FINAL\((.*)\)\s*$", "", cleaned, flags=re.DOTALL).strip()
        if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in {'"', "'"}:
            cleaned = cleaned[1:-1].strip()
        return cleaned

    def _looks_like_placeholder(self, answer: str) -> bool:
        return bool(re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", answer.strip()))

    def _select_rulebook_payload(self, question: str) -> dict[str, Any]:
        payload = self.corpus_manager.build_rlm_context()
        lower = question.lower()
        demo_terms = ("alden", "nyra", "duel", "this demo", "character sheet", "spell slot", "rage")
        if any(term in lower for term in demo_terms):
            supporting_pages = payload["supporting_pages"]
            return {
                **payload,
                "pages": supporting_pages,
                "primary_pages": [],
                "supporting_pages": supporting_pages,
                "source_index": {"phb": [], "supporting": [page["page_number"] for page in supporting_pages]},
            }
        return payload
