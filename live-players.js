// Legacy multiplayer renderer disabled.
// Multiplayer is rendered directly inside main.js as true Three.js world avatars.
// Keep this file as a safe no-op for stale cached HTML that may still request it.
try {
  document.getElementById('livePlayersLayer')?.remove();
  document.querySelectorAll('.live-player').forEach((el) => el.remove());
} catch {}
