## Audio Feature

Owns:
- client playback queue
- room-scoped audio event handling
- browser voice-unlock state

Canonical files:
- `AudioBroadcastPlayer.jsx` for authoritative room audio playback
- `useVoiceUnlock.js` for autoplay-unlock state

Does not own:
- server voice synthesis policy
- server-side transcript generation
