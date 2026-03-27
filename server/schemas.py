from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class MemoryQueryRequest(BaseModel):
    query: str
    max_results: int = Field(default=5, ge=1, le=12)


class QuestionRequest(BaseModel):
    mode: Literal["rag", "rlm"]
    question: str
    session_id: str = "default-session"
    session_state: dict[str, Any] | None = None
    logs: list[dict[str, Any]] | None = None
    max_results: int = Field(default=5, ge=1, le=12)


class CompareRequest(BaseModel):
    question: str
    session_id: str = "compare-session"
    session_state: dict[str, Any] | None = None
    logs: list[dict[str, Any]] | None = None
    max_results: int = Field(default=5, ge=1, le=12)


class BenchmarkRunRequest(BaseModel):
    session_id: str = "benchmark-session"
    benchmark_ids: list[str] | None = None
    session_state: dict[str, Any] | None = None
    logs: list[dict[str, Any]] | None = None
    max_results: int = Field(default=5, ge=1, le=12)


class ResetSessionRequest(BaseModel):
    session_id: str = "default-session"
