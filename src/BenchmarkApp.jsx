import React from "react";
import "../demo.css";
import { getApiAssetUrl } from "./api";
import MemoryWorkbench from "./MemoryWorkbench";

export default function BenchmarkApp() {
  return (
    <div className="react-demo-shell benchmark-home">
      <section className="overview-band">
        <div>
          <p className="eyebrow">Memory Comparison</p>
          <h1>RAG vs RLM Workbench</h1>
          <p className="overview-copy">
            This page is the benchmark surface. Use it to compare retrieval-based memory and RLM-based
            memory against the same D&D questions and PHB corpus.
          </p>
        </div>
        <div className="overview-chips">
          <a className="status-pill benchmark-link" href="/demo.html">Open Duel Demo</a>
          <a className="status-pill benchmark-link" href={getApiAssetUrl("/phb/pdf")} target="_blank" rel="noreferrer">Open PHB PDF</a>
          <span className="status-pill">FastAPI Backend</span>
          <span className="status-pill">PHB-Aware</span>
        </div>
      </section>

      <MemoryWorkbench />

      <section className="panel benchmark-notes">
        <p className="eyebrow">Pages</p>
        <h2>Available Routes</h2>
        <ul>
          <li><strong>/</strong> benchmark and comparison workbench</li>
          <li><strong>/demo.html</strong> duel UI and legacy runtime</li>
          <li><strong>/api/phb/pdf</strong> direct PHB PDF viewer</li>
          <li><strong>http://localhost:8000/docs</strong> FastAPI endpoint docs</li>
        </ul>
      </section>
    </div>
  );
}
