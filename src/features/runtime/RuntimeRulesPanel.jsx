import React from "react";

export function RuntimeRulesPanel({
  searchQuery,
  searchResults,
  corpusSources,
  busy,
  onSearchQueryChange,
  onSearch,
}) {
  return (
    <section className="panel runtime-rules-panel">
      <div className="runtime-transcript-head">
        <div>
          <p className="eyebrow">Rules</p>
          <h2>Corpus Lookup</h2>
        </div>
      </div>
      <div className="corpus-search-panel">
        <label className="memory-field">
          <span>Lookup</span>
          <input value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} />
        </label>
        <button type="button" onClick={onSearch} disabled={busy === "search"}>
          {busy === "search" ? "Searching..." : "Search Corpus"}
        </button>
      </div>
      <div className="corpus-source-list">
        {corpusSources.map((source) => (
          <article key={source._id} className="corpus-source-card">
            <strong>{source.sourceLabel}</strong>
            <span>{source.rulesDomain}</span>
            <span>{source.chunkCount} chunks</span>
          </article>
        ))}
      </div>
      <div className="search-result-list">
        {searchResults.map((result, index) => (
          <article key={`${result.sourceKey}-${index}`} className="search-result-card">
            <strong>{result.sourceLabel}</strong>
            <p className="beta-copy">{result.excerpt}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
