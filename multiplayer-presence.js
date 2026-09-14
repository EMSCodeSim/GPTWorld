// Legacy multiplayer overlay disabled.
// Multiplayer is rendered only by main.js as true Three.js world-space avatars.
// This no-op remains so stale cached resource-sync modules cannot recreate the old overlay.
try {
  document.getElementById('remotePlayersLayer')?.remove();
  document.querySelectorAll('.remote-player').forEach((el) => el.remove());
} catch {}
