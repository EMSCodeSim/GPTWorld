// Infrastructure-only ecology clock.
// This scheduled function keeps the ecosystem advancing even when no player
// opens the game and independently of GPTWorld's numbered narrative day.

export default async () => {
  const baseUrl = String(process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    console.error('GPTWorld ecosystem tick: site URL unavailable');
    return;
  }

  try {
    // world.mjs owns the server-authoritative ecology evolution routine.
    // That routine is idempotent by persisted lastRealDate, so hourly checks
    // can safely result in at most one ecological-year advance per UTC date.
    const response = await fetch(`${baseUrl}/.netlify/functions/world`, {
      method: 'GET',
      headers: { 'user-agent': 'gptworld-ecosystem-clock/1.0' }
    });

    if (!response.ok) {
      console.error(`GPTWorld ecosystem tick failed: HTTP ${response.status}`);
      return;
    }

    const data = await response.json();
    const ecosystem = data?.ecosystem || data?.world?.ecosystem || null;
    console.log('GPTWorld ecosystem tick complete', {
      simulatedYear: ecosystem?.simulatedYear ?? null,
      lastRealDate: ecosystem?.lastRealDate ?? null
    });
  } catch (error) {
    console.error('GPTWorld ecosystem tick error', String(error?.message || error));
  }
};

export const config = {
  schedule: '@hourly'
};
