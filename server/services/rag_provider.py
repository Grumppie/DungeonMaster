from __future__ import annotations

import json
import math
import time
from typing import Any

from server.config import Settings
from server.services.corpus import CorpusManager
from server.services.openai_utils import extract_response_text


def cosine_similarity(left: list[float], right: list[float]) -> float:
    dot = 0.0
    left_mag = 0.0
    right_mag = 0.0
    for left_value, right_value in zip(left, right, strict=True):
        dot += left_value * right_value
        left_mag += left_value * left_value
        right_mag += right_value * right_value
    if left_mag == 0 or right_mag == 0:
        return 0.0
    return dot / (math.sqrt(left_mag) * math.sqrt(right_mag))


class RagMemoryProvider:
    def __init__(self, settings: Settings, corpus_manager: CorpusManager, openai_client: Any):
        self.settings = settings
        self.corpus_manager = corpus_manager
        self.client = openai_client

    def query(self, query: str, max_results: int = 5) -> list[dict[str, Any]]:
        if not self.client:
            return []
        index = self._ensure_index()
        query_embedding = self._embed_texts([query])[0]
        results = sorted(
            (
                {
                    "id": item["id"],
                    "title": item["title"],
                    "source": item["source"],
                    "pageNumber": item["pageNumber"],
                    "text": item["text"],
                    "score": cosine_similarity(query_embedding, item["embedding"]),
                }
                for item in index
            ),
            key=lambda item: item["score"],
            reverse=True,
        )
        return results[:max_results]

    def answer(
        self,
        question: str,
        session_state: dict[str, Any] | None,
        logs: list[dict[str, Any]] | None,
        max_results: int = 5,
    ) -> dict[str, Any]:
        started = time.perf_counter()
        if not self.client:
            return {
                "mode": "rag",
                "answer": "OpenAI API key is missing, so the RAG backend is unavailable.",
                "latencyMs": round((time.perf_counter() - started) * 1000, 1),
                "support": [],
                "error": "missing_openai_key",
            }

        retrieval_started = time.perf_counter()
        results = self.query(question, max_results=max_results)
        retrieval_ms = round((time.perf_counter() - retrieval_started) * 1000, 1)
        state_block = self._serialize_state(session_state)
        log_block = self._serialize_logs(logs)
        support_block = "\n\n".join(
            f"[{index + 1}] {item['title']} p.{item['pageNumber']} ({item['source']})\n{item['text']}"
            for index, item in enumerate(results)
        ) or "No retrieved support."

        response = self.client.responses.create(
            model=self.settings.openai_model,
            input=[
                {
                    "role": "system",
                    "content": (
                        "You answer D&D 5e 2014 questions using only the supplied evidence and explicit game state. "
                        "If the evidence is insufficient, say so plainly. Cite the support item numbers you used."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Question:\n{question}\n\n"
                        f"Explicit game state:\n{state_block}\n\n"
                        f"Recent log context:\n{log_block}\n\n"
                        f"Retrieved support:\n{support_block}"
                    ),
                },
            ],
            temperature=0.2,
            max_output_tokens=500,
        )
        answer = extract_response_text(response)
        total_ms = round((time.perf_counter() - started) * 1000, 1)
        return {
            "mode": "rag",
            "answer": answer,
            "latencyMs": total_ms,
            "retrievalMs": retrieval_ms,
            "support": [
                {
                    "id": item["id"],
                    "title": item["title"],
                    "pageNumber": item["pageNumber"],
                    "source": item["source"],
                    "score": round(item["score"], 4),
                    "text": item["text"],
                }
                for item in results
            ],
        }

    def _serialize_state(self, session_state: dict[str, Any] | None) -> str:
        if not session_state:
            return "No live session state supplied."
        return json.dumps(session_state, indent=2)[:5000]

    def _serialize_logs(self, logs: list[dict[str, Any]] | None) -> str:
        if not logs:
            return "No recent logs supplied."
        trimmed = logs[:12]
        lines = []
        for item in trimmed:
            lines.append(f"{item.get('timestamp', 'unknown')} [{item.get('kind', 'log')}]: {item.get('message', '')}")
        return "\n".join(lines)[:4000]

    def _ensure_index(self) -> list[dict[str, Any]]:
        pages = self.corpus_manager.get_rulebook_pages()
        chunks = self.corpus_manager.chunk_pages(pages)
        corpus_hash = self.corpus_manager.compute_corpus_hash(pages)
        cache_path = self.corpus_manager.vector_cache_path
        if cache_path.exists():
            try:
                payload = json.loads(cache_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                payload = None
            if payload and payload.get("corpusHash") == corpus_hash and isinstance(payload.get("index"), list):
                return payload["index"]

        embeddings = self._embed_texts([chunk["text"] for chunk in chunks])
        index = []
        for chunk, embedding in zip(chunks, embeddings, strict=True):
            index.append({**chunk, "embedding": embedding})
        cache_path.write_text(
            json.dumps(
                {
                    "corpusHash": corpus_hash,
                    "model": self.settings.embedding_model,
                    "index": index,
                }
            ),
            encoding="utf-8",
        )
        return index

    def _embed_texts(self, texts: list[str]) -> list[list[float]]:
        embeddings: list[list[float]] = []
        for start in range(0, len(texts), 64):
            batch = texts[start : start + 64]
            response = self.client.embeddings.create(model=self.settings.embedding_model, input=batch)
            embeddings.extend(item.embedding for item in response.data)
        return embeddings
