import React, { useEffect } from "react";
import "../demo.css";
import MemoryWorkbench from "./MemoryWorkbench";

const pipeline = [
  "Player speech or typed turn enters the browser.",
  "Deepgram live STT shows interim and final transcript text.",
  "The name gate accepts only Alden or Nyra and rejects stray speech.",
  "Vector memory retrieves relevant rules and character guidance.",
  "OpenAI classifies intent and delivers dramatic DM narration.",
  "The local 5e duel engine resolves rolls, HP, conditions, and logs.",
  "Deepgram TTS voices the DM unless the user barges in."
];

const ownership = {
  browser: [
    "Desktop duel UI, local session state, and full combat mutations",
    "Microphone capture, barge-in interruption, and transcript visibility",
    "Character tooltips, sheets, spell detail, and audit log rendering"
  ],
  api: [
    "Env-backed bootstrap for OpenAI and Deepgram configuration",
    "Local vector retrieval over the DM skill, prompt, sheets, and rules corpus",
    "A thin local bridge so the client no longer asks for manual setup"
  ],
  inference: [
    "Strict 5e 2014 duel framing for Alden and Nyra",
    "DM tone guidance so the voice reads like a dramatic narrator",
    "Relevant rules chunks pulled on demand before intent classification"
  ]
};

export default function App() {
  useEffect(() => {
    let disposed = false;
    let unmount;

    async function mount() {
      const mod = await import("../demo.js");
      if (!disposed && typeof mod.mountDndDemo === "function") {
        mod.mountDndDemo();
        unmount = mod.unmountDndDemo;
      }
    }

    mount();

    return () => {
      disposed = true;
      if (typeof unmount === "function") {
        unmount();
      }
    };
  }, []);

  return (
    <div className="react-demo-shell">
      <section className="overview-band">
        <div>
          <p className="eyebrow">React + Vite Runtime</p>
          <h1>Dungeon Master Duel Demo</h1>
          <p className="overview-copy">
            The main duel now mounts directly on the React root. No manual key form is exposed:
            the local API bootstraps OpenAI and Deepgram config, and the DM engine handles
            initiative, rules, retrieval, narration, and voice interruption.
          </p>
        </div>
        <div className="overview-chips">
          <span className="status-pill">Strict 5e 2014 Duel</span>
          <span className="status-pill">Voice First</span>
          <span className="status-pill">Env-Backed Bootstrap</span>
        </div>
      </section>

      <MemoryWorkbench />

      <div className="demo-shell">
        <header className="demo-header">
          <a className="back-link" href="#architecture" aria-label="Jump to architecture">
            ?
          </a>
          <div className="header-main">
            <div className="avatar-frame dm-frame">
              <img src="/assets/dm-avatar.svg" alt="Dungeon Master avatar" />
            </div>
            <div className="title-block">
              <p className="eyebrow">Dungeon Master</p>
              <h1>Iron Quill Duel Table</h1>
              <div className="header-status-row">
                <span className="status-pill" id="stage-label">Awaiting Claims</span>
                <span className="status-note" id="engagement-label">Engagement: Duel</span>
                <span className="status-note" id="turn-banner">Turn: Pending</span>
              </div>
            </div>
          </div>
          <div className="initiative-panel">
            <p className="eyebrow">Initiative</p>
            <div id="initiative-order" className="initiative-order"></div>
          </div>
        </header>

        <main className="main-grid">
          <section className="dm-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">DM Screen</p>
                <h2>Voice, Rules, and Session Control</h2>
              </div>
              <div className="status-box" id="status-box">Bootstrapping the duel runtime.</div>
            </div>

            <div className="bootstrap-note">
              <p className="eyebrow">Bootstrap</p>
              <p>The local API injects OpenAI and Deepgram configuration automatically for this demo.</p>
            </div>

            <div className="control-row">
              <button id="begin-demo" type="button">Begin Demo Intro</button>
              <button id="start-voice" type="button">Start Voice</button>
              <button id="stop-voice" type="button" className="secondary">Stop Voice</button>
              <button id="reset-session" type="button" className="secondary">Reset Session</button>
              <button id="export-state" type="button" className="secondary">Export State</button>
              <button id="export-log" type="button" className="secondary">Export Log</button>
            </div>

            <div className="transcript-grid">
              <article className="transcript-card">
                <p className="eyebrow">Live STT</p>
                <h3>Interim Transcript</h3>
                <p id="live-transcript" className="transcript-text">Deepgram live speech appears here.</p>
              </article>
              <article className="transcript-card">
                <p className="eyebrow">Final STT</p>
                <h3>Last Final Transcript</h3>
                <p id="final-transcript" className="transcript-text">Finalized utterances appear here.</p>
              </article>
              <article className="transcript-card">
                <p className="eyebrow">Hint</p>
                <h3>Interaction Rule</h3>
                <p id="hint-text" className="transcript-text">Say "Alden" or "Nyra" first or the DM will ignore the command.</p>
              </article>
            </div>

            <div className="manual-block">
              <label htmlFor="manual-command" className="eyebrow">Manual Text Turn</label>
              <textarea
                id="manual-command"
                rows="3"
                placeholder='Example: Alden, I rage and attack with my greataxe.'
              />
              <button id="send-command" type="button">Send Command</button>
            </div>

            <div className="log-panel">
              <div className="panel-head compact">
                <div>
                  <p className="eyebrow">Audit Trail</p>
                  <h3>DM Log</h3>
                </div>
                <span className="log-count" id="log-count">0 entries</span>
              </div>
              <div id="log-feed" className="log-feed"></div>
            </div>
          </section>

          <aside className="side-panel">
            <section className="side-card">
              <p className="eyebrow">Encounter</p>
              <h2 id="encounter-title">Duel at the Cartographer&apos;s Table</h2>
              <p id="encounter-summary">Claim both heroes to start initiative. The duel begins at 20 feet.</p>
            </section>

            <section className="side-card">
              <p className="eyebrow">Battlefield</p>
              <div className="metric-row">
                <span>Distance</span>
                <strong id="distance-metric">20 ft</strong>
              </div>
              <div className="metric-row">
                <span>Round</span>
                <strong id="round-metric">0</strong>
              </div>
              <div className="metric-row">
                <span>Conditions</span>
                <strong id="effect-metric">None</strong>
              </div>
            </section>

            <section className="side-card">
              <p className="eyebrow">Pipeline</p>
              <ul className="bullet-list">
                <li>Deepgram STT streams speech and renders visible interim and final text.</li>
                <li>Voice activity interrupts TTS and aborts pending inference.</li>
                <li>OpenAI classifies intent while retrieval adds focused rules context.</li>
                <li>The local engine resolves the duel and writes an inspectable audit trail.</li>
              </ul>
            </section>
          </aside>
        </main>

        <footer className="player-row">
          <section id="player-card-alden" className="player-card"></section>
          <section id="player-card-nyra" className="player-card"></section>
        </footer>
      </div>

      <section id="architecture" className="architecture-panel">
        <div className="architecture-head">
          <div>
            <p className="eyebrow">Architecture</p>
            <h2>Business Logic Flow</h2>
          </div>
          <p className="architecture-copy">
            The app treats the browser as the tabletop, the local API as the configuration and retrieval
            bridge, and the DM prompt stack as the behavior contract for inference.
          </p>
        </div>

        <div className="architecture-grid">
          <section className="panel wide">
            <p className="eyebrow">Flow</p>
            <h2>End-to-End Pipeline</h2>
            <div className="pipeline">
              {pipeline.map((item, index) => (
                <div className="pipeline-card" key={item}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Browser</p>
            <h2>Client Role</h2>
            <ul>
              {ownership.browser.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section className="panel">
            <p className="eyebrow">Local API</p>
            <h2>Server Role</h2>
            <ul>
              {ownership.api.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section className="panel wide">
            <p className="eyebrow">Inference</p>
            <h2>DM Skill Contract</h2>
            <ul>
              {ownership.inference.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p className="note">
              Retrieval is built from the local DM guidance, prompts, character sheets, and rules corpus.
              The demo uses that memory to pull relevant rules context on demand.
            </p>
          </section>
        </div>
      </section>

      <dialog id="sheet-modal" className="modal">
        <div className="modal-shell">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">Character Sheet</p>
              <h2 id="sheet-title">Sheet</h2>
            </div>
            <button id="close-sheet" type="button" className="secondary">Close</button>
          </div>
          <div id="sheet-body" className="modal-body"></div>
        </div>
      </dialog>

      <dialog id="spell-modal" className="modal">
        <div className="modal-shell">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">Spell Detail</p>
              <h2 id="spell-title">Spell</h2>
            </div>
            <button id="close-spell" type="button" className="secondary">Close</button>
          </div>
          <div id="spell-body" className="modal-body"></div>
        </div>
      </dialog>

      <audio id="tts-audio"></audio>
    </div>
  );
}
