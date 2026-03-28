import React, { useEffect, useMemo, useState } from "react";

function getRemainingSeconds(turnTimerEndsAt) {
  if (!turnTimerEndsAt) {
    return null;
  }
  return Math.max(0, Math.ceil((turnTimerEndsAt - Date.now()) / 1000));
}

export function TurnTimer({ turnTimerEndsAt }) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => getRemainingSeconds(turnTimerEndsAt));

  useEffect(() => {
    setRemainingSeconds(getRemainingSeconds(turnTimerEndsAt));
    if (!turnTimerEndsAt) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setRemainingSeconds(getRemainingSeconds(turnTimerEndsAt));
    }, 250);

    return () => window.clearInterval(interval);
  }, [turnTimerEndsAt]);

  const label = useMemo(() => {
    if (remainingSeconds == null) {
      return "No timer";
    }
    return `${remainingSeconds}s`;
  }, [remainingSeconds]);

  return <span className="status-pill">{label}</span>;
}
