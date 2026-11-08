import { cookies } from 'next/headers';
import { cookieName, formBody, getSession, getValidSession, sameSecret, upstream } from '@/lib/admin-security';

export const runtime = 'nodejs';
const reply = (status: number, value?: unknown) => new Response(value ? JSON.stringify(value) : null, { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex, nofollow' } });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.ENABLE_ADMIN_BFF !== 'true') return reply(404);
  const sessionId = (await cookies()).get(cookieName)?.value;
  const current = getSession(sessionId);
  if (!current) return reply(401);
  const { id } = await params, form = await formBody(request);
  if (!form || !sameSecret(form.get('csrf') ?? undefined, current.csrf)) return reply(403);
  const reason = (form.get('reason') ?? '').trim(), code = form.get('code') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id) || ['csrf', 'reason', 'code', 'verified'].some(key => form.getAll(key).length !== 1) || form.get('verified') !== 'yes' || reason.length < 10 || reason.length > 1000 || !/^\d{6}$/.test(code)) return reply(400);
  const session = await getValidSession(sessionId).catch(() => undefined);
  if (session === undefined) return reply(503);
  if (!session) return reply(401);
  try {
    const response = await upstream(`/admin/users/${id}/totp-recovery`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json', 'X-TOTP-Code': code }, body: JSON.stringify({ reason }) });
    if ([400, 401, 403, 409, 429].includes(response.status)) return reply(response.status);
    if (response.status !== 200) return reply(503);
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || !('authorized' in value) || value.authorized !== true || !('availableAt' in value) || typeof value.availableAt !== 'string' || !Number.isFinite(Date.parse(value.availableAt))) return reply(503);
    return reply(200, value);
  } catch { return reply(503); }
}
