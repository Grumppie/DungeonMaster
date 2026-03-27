import React, { useEffect, useState, startTransition } from "react";
import { fetchApiJson, postApiJson } from "./api";

const SESSION_STORAGE_KEYS = {
  session: "dnd-demo-session",
  logs: "dnd-demo-logs",
};

const DEFAULT_QUESTION = "What does Rage do for Alden Voss in this duel?";

export default function MemoryWorkbench() {
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [includeDuelState, setIncludeDuelState] = useState(true);
  const [sessionId, setSessionId] = useState("memory-lab-session");
  const [loading, setLoading] = useState(false);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [status, setStatus] = useState("Loading corpus status.");
  const [corpusStatus, setCorpusStatus] = useState(null);
  const [benchmarks, setBenchmarks] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [singleResult, setSingleResult] = useState(null);
  const [benchmarkResults, setBenchmarkResults] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [corpus, benchmarkList] = await Promise.all([
          fetchApiJson("/corpus/status"),
          fetchApiJson("/benchmarks"),
        ]);
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setCorpusStatus(corpus);
          setBenchmarks(Array.isArray(benchmarkList) ? benchmarkList : []);
          setStatus(corpus.hasPdf ? "PHB corpus ready." : "PHB.pdf not found. Using fallback duel corpus.");
        });
      } catch (error) {
        if (!cancelled) {
          setStatus(String(error));
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCompare() {
    setLoading(true);
    setSingleResult(null);
    try {
      const payload = buildPayload(question, sessionId, includeDuelState);
      const result = await postApiJson("/compare", payload);
      startTransition(() => {
        setComparison(result);
        setStatus("Comparison complete.");
      });
    } catch (error) {
      setStatus(String(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSingle(mode) {
    setLoading(true);
    setComparison(null);
    try {
      const payload = {
        ...buildPayload(question, sessionId, includeDuelState),
        mode,
      };
      const result = await postApiJson("/ask", payload);
      startTransition(() => {
        setSingleResult(result);
        setStatus(`${mode.toUpperCase()} answer ready.`);
      });
    } catch (error) {
      setStatus(String(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleRunBenchmarks() {
    setBenchmarkLoading(true);
    try {
      const result = await postApiJson("/benchmark/run", buildPayload(question, sessionId, includeDuelState));
      startTransition(() => {
        setBenchmarkResults(result.results || []);
        setStatus("Benchmark run complete.");
      });
    } catch (error) {
      setStatus(String(error));
    } finally {
      setBenchmarkLoading(false);
    }
  }

  async function handleReset() {
    try {
      await postApiJson("/rlm/reset", { session_id: sessionId });
      setStatus("RLM session reset.");
    } catch (error) {
      setStatus(String(error));
    }
  }

  return (
    <section className="memory-lab panel wide">
      <div className="memory-lab-head">
        <div>
          <p className="eyebrow">FastAPI Memory Lab</p>
          <h2>RAG vs RLM</h2>
          <p className="memory-copy">
            Compare speed and answer quality between a retrieval-only memory path and a pure RLM session.
          </p>
        </div>
        <div className="memory-status">
          <span className="status-pill">{corpusStatus?.source === "pdf" ? "PHB PDF" : "Fallback Corpus"}</span>
          <span className="status-note">{status}</span>
        </div>
      </div>

      <div className="memory-controls">
        <label className="memory-field">
          <span>Session ID</span>
          <input value={sessionId} onChange={(event) => setSessionId(event.target.value)} />
        </label>
        <label className="memory-field memory-field-wide">
          <span>Question</span>
          <textarea
            rows="3"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a D&D rules or state question."
          />
        </label>
      </div>

      <div className="memory-actions">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={includeDuelState}
            onChange={(event) => setIncludeDuelState(event.target.checked)}
          />
          <span>Include current duel state and recent logs</span>
        </label>
        <div className="control-row">
          <button type="button" onClick={handleCompare} disabled={loading || benchmarkLoading}>
            {loading ? "Comparing..." : "Compare Both"}
          </button>
          <button type="button" className="secondary" onClick={() => handleSingle("rag")} disabled={loading || benchmarkLoading}>
            Ask RAG
          </button>
          <button type="button" className="secondary" onClick={() => handleSingle("rlm")} disabled={loading || benchmarkLoading}>
            Ask RLM
          </button>
          <button type="button" className="secondary" onClick={handleRunBenchmarks} disabled={loading || benchmarkLoading}>
            {benchmarkLoading ? "Running Benchmarks..." : "Run Benchmarks"}
          </button>
          <button type="button" className="secondary" onClick={handleReset} disabled={loading || benchmarkLoading}>
            Reset RLM Session
          </button>
        </div>
      </div>

      <div className="memory-meta-grid">
        <article className="memory-card">
          <p className="eyebrow">Corpus</p>
          <h3>{corpusStatus?.title || "Loading"}</h3>
          <p>{corpusStatus ? `${corpusStatus.pageCount} pages, ${corpusStatus.chunkCount} chunks.` : "Waiting for API."}</p>
        </article>
        <article className="memory-card">
          <p className="eyebrow">Benchmarks</p>
          <h3>{benchmarks.length}</h3>
          <div className="benchmark-preview-list">
            {benchmarks.length ? benchmarks.slice(0, 6).map((item) => (
              <div key={item.id} className="benchmark-preview-item">
                <strong>{item.id}</strong>
                <span>{item.category} / {item.difficulty}</span>
              </div>
            )) : "No benchmark set loaded."}
          </div>
        </article>
      </div>

      {comparison ? (
        <div className="memory-results-grid">
          <ResultCard title="RAG" result={comparison.rag} />
          <ResultCard title="RLM" result={comparison.rlm} />
        </div>
      ) : null}

      {singleResult ? (
        <div className="memory-results-grid single-mode">
          <ResultCard title={singleResult.mode.toUpperCase()} result={singleResult} />
        </div>
      ) : null}

      {benchmarkResults.length ? (
        <div className="benchmark-table-wrap">
          <table className="benchmark-table">
            <thead>
              <tr>
                <th>Benchmark</th>
                <th>Category</th>
                <th>RAG ms</th>
                <th>RAG score</th>
                <th>RLM ms</th>
                <th>RLM score</th>
              </tr>
            </thead>
            <tbody>
              {benchmarkResults.map((item) => (
                <tr key={item.benchmark.id}>
                  <td>{item.benchmark.id}</td>
                  <td>{item.benchmark.category}</td>
                  <td>{item.rag.latencyMs}</td>
                  <td>{formatScore(item.ragScore.score)}</td>
                  <td>{item.rlm.latencyMs}</td>
                  <td>{formatScore(item.rlmScore.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {benchmarkResults.length ? (
        <div className="benchmark-detail-list">
          {benchmarkResults.map((item) => (
            <article key={item.benchmark.id} className="memory-card">
              <p className="eyebrow">{item.benchmark.category} / {item.benchmark.difficulty}</p>
              <h3>{item.benchmark.id}</h3>
              <p className="result-answer">{item.benchmark.question}</p>
              <div className="benchmark-response-grid">
                <BenchmarkResponseCard title="RAG" result={item.rag} score={item.ragScore} />
                <BenchmarkResponseCard title="RLM" result={item.rlm} score={item.rlmScore} />
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ResultCard({ title, result }) {
  return (
    <article className="memory-card result-card">
      <div className="result-head">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>{result.latencyMs} ms</h3>
        </div>
        {result.retrievalMs ? <span className="status-note">retrieval {result.retrievalMs} ms</span> : null}
      </div>
      <p className="result-answer">{result.answer}</p>
      {Array.isArray(result.support) && result.support.length ? (
        <div className="support-list">
          {result.support.slice(0, 3).map((item) => (
            <div key={item.id} className="support-item">
              <strong>{item.title} p.{item.pageNumber}</strong>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function BenchmarkResponseCard({ title, result, score }) {
  return (
    <section className="benchmark-response-card">
      <div className="result-head">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>{result.latencyMs} ms</h3>
        </div>
        <span className="status-note">score {formatScore(score?.score)}</span>
      </div>
      <p className="result-answer">{result.answer}</p>
      <RubricSummary score={score} />
    </section>
  );
}

function RubricSummary({ score }) {
  if (!score) {
    return null;
  }

  const hasMatched =
    (Array.isArray(score.matched) && score.matched.length > 0) ||
    (Array.isArray(score.matchedAnyGroups) && score.matchedAnyGroups.length > 0);
  const hasMissed =
    (Array.isArray(score.missed) && score.missed.length > 0) ||
    (Array.isArray(score.missedAnyGroups) && score.missedAnyGroups.length > 0);

  if (!hasMatched && !hasMissed) {
    return null;
  }

  return (
    <div className="benchmark-rubric">
      {hasMatched ? (
        <div>
          <p className="eyebrow">Matched</p>
          <div className="benchmark-chip-list">
            {score.matched.map((item) => (
              <span key={`matched-${item}`} className="benchmark-chip hit">{item}</span>
            ))}
            {score.matchedAnyGroups.map((item) => (
              <span key={`matched-any-${item.matched}`} className="benchmark-chip hit">{item.matched}</span>
            ))}
          </div>
        </div>
      ) : null}
      {hasMissed ? (
        <div>
          <p className="eyebrow">Missed</p>
          <div className="benchmark-chip-list">
            {score.missed.map((item) => (
              <span key={`missed-${item}`} className="benchmark-chip miss">{item}</span>
            ))}
            {score.missedAnyGroups.map((group) => (
              <span key={`missed-any-${group.join("|")}`} className="benchmark-chip miss">{group.join(" / ")}</span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildPayload(question, sessionId, includeDuelState) {
  const local = includeDuelState ? readLocalDuelState() : { session_state: null, logs: null };
  return {
    question,
    session_id: sessionId,
    session_state: local.session_state,
    logs: local.logs,
  };
}

function readLocalDuelState() {
  try {
    const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEYS.session);
    const rawLogs = window.localStorage.getItem(SESSION_STORAGE_KEYS.logs);
    return {
      session_state: rawSession ? JSON.parse(rawSession) : null,
      logs: rawLogs ? JSON.parse(rawLogs) : null,
    };
  } catch (error) {
    return { session_state: null, logs: [{ kind: "error", message: String(error) }] };
  }
}

function formatScore(score) {
  if (score === null || score === undefined) {
    return "n/a";
  }
  return score.toFixed(3);
}
