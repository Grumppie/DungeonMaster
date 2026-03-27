from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from server.config import Settings
from server.services.benchmark import BenchmarkSuite
from server.services.corpus import CorpusManager
from server.services.openai_utils import build_openai_client
from server.services.rag_provider import RagMemoryProvider
from server.services.rlm_provider import RlmMemoryProvider


class MemoryComparisonService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.corpus_manager = CorpusManager(settings)
        self.openai_client = build_openai_client(settings.openai_api_key)
        self.rag = RagMemoryProvider(settings, self.corpus_manager, self.openai_client)
        self.rlm = RlmMemoryProvider(settings, self.corpus_manager)
        self.benchmarks = BenchmarkSuite(settings.benchmark_path)
        self.executor = ThreadPoolExecutor(max_workers=2)

    def bootstrap(self) -> dict[str, Any]:
        return {
            "openaiKey": self.settings.openai_api_key,
            "openaiModel": self.settings.openai_model,
            "deepgramKey": self.settings.deepgram_api_key,
            "deepgramModel": self.settings.deepgram_model,
            "deepgramVoice": self.settings.deepgram_voice,
        }

    def ask(
        self,
        mode: str,
        question: str,
        session_id: str,
        session_state: dict[str, Any] | None,
        logs: list[dict[str, Any]] | None,
        max_results: int,
    ) -> dict[str, Any]:
        if mode == "rag":
            return self.rag.answer(question, session_state, logs, max_results=max_results)
        if mode == "rlm":
            return self.rlm.answer(question, session_state, logs, session_id=session_id)
        raise ValueError(f"Unsupported memory mode: {mode}")

    def compare(
        self,
        question: str,
        session_id: str,
        session_state: dict[str, Any] | None,
        logs: list[dict[str, Any]] | None,
        max_results: int,
    ) -> dict[str, Any]:
        rag_future = self.executor.submit(self.rag.answer, question, session_state, logs, max_results)
        rlm_future = self.executor.submit(self.rlm.answer, question, session_state, logs, session_id)
        return {
            "question": question,
            "rag": rag_future.result(),
            "rlm": rlm_future.result(),
        }

    def run_benchmark(
        self,
        session_id: str,
        benchmark_ids: list[str] | None,
        session_state: dict[str, Any] | None,
        logs: list[dict[str, Any]] | None,
        max_results: int,
    ) -> dict[str, Any]:
        self.rlm.reset(session_id)
        results = []
        for question in self.benchmarks.selected_questions(benchmark_ids):
            comparison = self.compare(
                question=question["question"],
                session_id=session_id,
                session_state=session_state,
                logs=logs,
                max_results=max_results,
            )
            comparison["benchmark"] = question
            comparison["ragScore"] = self.benchmarks.score_answer(question, comparison["rag"]["answer"])
            comparison["rlmScore"] = self.benchmarks.score_answer(question, comparison["rlm"]["answer"])
            results.append(comparison)
        return {"results": results}

    def stream_benchmark(
        self,
        session_id: str,
        benchmark_ids: list[str] | None,
        session_state: dict[str, Any] | None,
        logs: list[dict[str, Any]] | None,
        max_results: int,
    ):
        selected = self.benchmarks.selected_questions(benchmark_ids)
        started = time.perf_counter()
        self.rlm.reset(session_id)
        yield {"type": "start", "total": len(selected)}
        for index, question in enumerate(selected, start=1):
            yield {"type": "progress", "index": index, "total": len(selected), "benchmarkId": question["id"]}
            comparison = self.compare(
                question=question["question"],
                session_id=session_id,
                session_state=session_state,
                logs=logs,
                max_results=max_results,
            )
            comparison["benchmark"] = question
            comparison["ragScore"] = self.benchmarks.score_answer(question, comparison["rag"]["answer"])
            comparison["rlmScore"] = self.benchmarks.score_answer(question, comparison["rlm"]["answer"])
            yield {
                "type": "result",
                "index": index,
                "total": len(selected),
                "result": comparison,
            }
        yield {
            "type": "complete",
            "total": len(selected),
            "elapsedMs": round((time.perf_counter() - started) * 1000, 1),
        }

    def list_benchmarks(self) -> list[dict[str, Any]]:
        return self.benchmarks.list_questions()

    def corpus_status(self) -> dict[str, Any]:
        return self.corpus_manager.corpus_status()

    def rag_query(self, query: str, max_results: int) -> dict[str, Any]:
        return {"results": self.rag.query(query, max_results=max_results)}

    def reset_rlm_session(self, session_id: str) -> dict[str, Any]:
        self.rlm.reset(session_id)
        return {"ok": True, "sessionId": session_id}

    def close(self) -> None:
        self.executor.shutdown(wait=False, cancel_futures=True)
        self.rlm.close()
