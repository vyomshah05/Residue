import { NextRequest, NextResponse } from 'next/server';

import { bearerFromHeader, verifyAuthToken } from '@/lib/auth/tokens';
import { getActiveSessionForUser } from '@/lib/auth/store';

/**
 * GET /api/phone/active-session
 *
 * Lightweight polling endpoint for the iOS companion. Returns the
 * currently-active desktop study session (if any) for the JWT subject.
 * The phone polls this every few seconds and uses the
 * `currentlyStudying` transition as the trigger to auto-bind (false→true)
 * and auto-generate the on-device Melange distraction report
 * (true→false).
 *
 * Always scoped to `payload.uid` — there is no `userId` query param. A
 * phone can only see its own owner's sessions.
 */
export async function GET(req: NextRequest) {
  const token = bearerFromHeader(req.headers.get('authorization'));
  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const view = await getActiveSessionForUser(payload.uid);
  return NextResponse.json(view);
}
