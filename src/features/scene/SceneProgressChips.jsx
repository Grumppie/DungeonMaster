import React from "react";

import { SCENE_PURPOSES } from "../../contracts/scene";

export function SceneProgressChips({ activeScene, sceneProgress, dmStatus, speakerName, combat }) {
  return (
    <div className="overview-chips">
      <span className="status-pill">Purpose: {activeScene?.scenePurpose || SCENE_PURPOSES.INTRODUCE}</span>
      <span className="status-pill">
        Discovery {sceneProgress?.discoveryCompleted ? "1/1" : "0/1"}
      </span>
      <span className="status-pill">
        Commitment {sceneProgress?.commitmentCompleted ? "1/1" : "0/1"}
      </span>
      <span className="status-pill">Speaker: {speakerName}</span>
      {dmStatus !== "idle" ? <span className="status-pill active-turn">DM {dmStatus}</span> : null}
      {sceneProgress?.transitionUnlocked ? <span className="status-pill active-turn">Exit unlocked</span> : null}
      {combat?.encounter?.turnTimerEndsAt ? <span className="status-pill active-turn">Turn live</span> : null}
    </div>
  );
}
