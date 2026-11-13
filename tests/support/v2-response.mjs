// Contract shape for UI-only API fixtures. Security/rotation is tested against
// PostgreSQL and the real API in session-v2-real-browser.test.mjs.
export function v2FixtureResponse(data, req, res) {
  if (!data?.access_token) return data;
  const sid = req.headers['x-session-id'] || '00000000-0000-4000-8000-000000000001';
  const operation = req.headers['x-refresh-operation'];
  const generation = operation ? Number(req.headers['x-refresh-generation']) + 1 : 0;
  const previous = res.getHeader('set-cookie');
  res.setHeader('set-cookie', [
    ...(Array.isArray(previous) ? previous : previous ? [previous] : []),
    `griforio-dev-rt-${sid}-${generation}=fixture.refresh.${generation}; HttpOnly; SameSite=Strict; Path=/api/v1/auth`,
    `griforio-dev-proof-${sid}-${generation}=${'p'.repeat(43)}; HttpOnly; SameSite=Strict; Path=/api/v1/auth`,
  ]);
  return { ...data, session_id: sid, refresh_protocol: 2, refresh_generation: 0, generation,
    ...(operation ? { operation_id: operation, recovery_deadline: new Date(Date.now() + Math.min(120, data.expires_in) * 1000).toISOString() } : {}),
  };
}
