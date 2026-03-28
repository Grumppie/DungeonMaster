import React from "react";

export function HistoryDrawer({ title, items, open, onClose, emptyText, renderItem }) {
  if (!open) {
    return null;
  }

  return (
    <div className="history-drawer-backdrop" onClick={onClose}>
      <aside className="panel history-drawer-panel" onClick={(event) => event.stopPropagation()}>
        <div className="runtime-transcript-head">
          <div>
            <p className="eyebrow">History</p>
            <h3>{title}</h3>
          </div>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="history-drawer-list">
          {items?.length ? items.map(renderItem) : <p className="beta-copy">{emptyText}</p>}
        </div>
      </aside>
    </div>
  );
}
