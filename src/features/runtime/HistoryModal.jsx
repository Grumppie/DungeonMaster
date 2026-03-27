import React from "react";

export function HistoryModal({ title, items, open, onClose, emptyText, renderItem }) {
  if (!open) {
    return null;
  }

  return (
    <div className="selection-modal-backdrop" onClick={onClose}>
      <section className="panel history-modal" onClick={(event) => event.stopPropagation()}>
        <div className="runtime-transcript-head">
          <div>
            <p className="eyebrow">History</p>
            <h3>{title}</h3>
          </div>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="history-modal-list">
          {items?.length ? items.map(renderItem) : <p className="beta-copy">{emptyText}</p>}
        </div>
      </section>
    </div>
  );
}
