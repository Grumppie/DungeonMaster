from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from server.config import settings
from server.schemas import (
    BenchmarkRunRequest,
    CompareRequest,
    MemoryQueryRequest,
    QuestionRequest,
    ResetSessionRequest,
)
from server.services.memory_service import MemoryComparisonService

app = FastAPI(title="D&D Memory Lab", version="0.1.0")
service = MemoryComparisonService(settings)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/bootstrap")
def bootstrap() -> dict[str, str]:
    return service.bootstrap()


@app.get("/api/corpus/status")
def corpus_status() -> dict[str, object]:
    return service.corpus_status()


@app.get("/api/benchmarks")
def benchmarks() -> list[dict[str, object]]:
    return service.list_benchmarks()


@app.get("/api/phb/pdf")
def phb_pdf() -> FileResponse:
    if not settings.phb_pdf_path.exists():
        raise HTTPException(status_code=404, detail="PHB.pdf not found")
    return FileResponse(settings.phb_pdf_path, media_type="application/pdf", filename="PHB.pdf")


@app.post("/api/memory/query")
def memory_query(body: MemoryQueryRequest) -> dict[str, object]:
    return service.rag_query(body.query, body.max_results)


@app.post("/api/ask")
def ask(body: QuestionRequest) -> dict[str, object]:
    try:
        return service.ask(
            mode=body.mode,
            question=body.question,
            session_id=body.session_id,
            session_state=body.session_state,
            logs=body.logs,
            max_results=body.max_results,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/compare")
def compare(body: CompareRequest) -> dict[str, object]:
    return service.compare(
        question=body.question,
        session_id=body.session_id,
        session_state=body.session_state,
        logs=body.logs,
        max_results=body.max_results,
    )


@app.post("/api/benchmark/run")
def benchmark_run(body: BenchmarkRunRequest) -> dict[str, object]:
    return service.run_benchmark(
        session_id=body.session_id,
        benchmark_ids=body.benchmark_ids,
        session_state=body.session_state,
        logs=body.logs,
        max_results=body.max_results,
    )


@app.post("/api/rlm/reset")
def reset_rlm(body: ResetSessionRequest) -> dict[str, object]:
    return service.reset_rlm_session(body.session_id)


@app.on_event("shutdown")
def shutdown() -> None:
    service.close()
