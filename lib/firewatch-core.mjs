// Read-only report of the live, server-authoritative world state.
// This is not the simulation clock and never changes project progress.
const bounded = (value) => {
  const n = Number(value);
  return value == null || !Number.isFinite(n) ? null : Math.max(0, Math.min(100, Math.round(n * 100)));
};

export function firewatchReport(world = {}) {
  const weather = world.weather_sim || {};
  const forest = world.forest_pressure || {};
  const disaster = world.disaster_sim || {};
  const project = world.firebreak_project || {};
  const fireActive = Array.isArray(disaster.active) && disaster.active.some(e => e?.type === 'wildfire');
  const risk = bounded(disaster.risks?.wildfire);
  const drought = bounded(weather.drought);
  const forestStage = String(forest.stage || 'unknown').replaceAll('_', ' ');
  const woodGoal = Math.max(0, Number(project.woodGoal ?? 6) || 0);
  const stoneGoal = Math.max(0, Number(project.stoneGoal ?? 24) || 0);
  const woodNeeded = Math.max(0, woodGoal - Math.max(0, Number(project.wood) || 0));
  const stoneNeeded = Math.max(0, stoneGoal - Math.max(0, Number(project.stone) || 0));
  const status = project.complete ? 'Firebreak complete' : `Firebreak needs ${woodNeeded} wood and ${stoneNeeded} stone`;
  return `${fireActive ? 'Active wildfire reported' : `Wildfire risk ${risk === null ? 'unavailable' : `${risk}%`}`} · Drought ${drought === null ? 'unavailable' : `${drought}%`} · Forest ${forestStage}. ${status}. ${project.complete ? 'Watch for changing conditions.' : 'Stage supplies at the nearby workbench.'}`;
}
