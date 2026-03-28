import { useEffect, useState } from "react";

export function useVoiceUnlock() {
  const [isVoiceUnlocked, setVoiceUnlocked] = useState(false);

  useEffect(() => {
    function unlockVoice() {
      setVoiceUnlocked(true);
    }

    window.addEventListener("pointerdown", unlockVoice);
    window.addEventListener("keydown", unlockVoice);

    return () => {
      window.removeEventListener("pointerdown", unlockVoice);
      window.removeEventListener("keydown", unlockVoice);
    };
  }, []);

  return {
    isVoiceUnlocked,
  };
}
