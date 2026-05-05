import { NextRequest, NextResponse } from 'next/server';

import { bearerFromHeader, verifyAuthToken } from '@/lib/auth/tokens';
import {
  autoClaimPairing,
  getActiveSessionForUser,
} from '@/lib/auth/store';

/**
 * POST /api/pair/auto
 *
 * Codeless companion to `/api/pair/{start,claim}`. Once the phone
 * polls `/api/phone/active-session` and sees its owner has started a
 * desktop study session, it calls this route to bind without the
 * 6-digit code dance. The 6-digit flow is preserved for cases where
 * the phone signs in to the desktop user manually.
 *
 * Body: { sessionId: string, phoneDeviceId: string }
 * Auth: Bearer token (phone JWT — same secret as the desktop token).
 *
 * Same-account enforcement:
 *   - JWT subject (payload.uid) must own the desktop session
 *     according to `user_data.studyStatus.currentSessionId`.
 *   - We refuse to bind to a stale `sessionId` that doesn't match
 *     the user's currently-active session.
 */
export async function POST(req: NextRequest) {
  const token = bearerFromHeader(req.headers.get('authorization'));
  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { sessionId, phoneDeviceId } = (await req.json()) as {
    sessionId?: string;
    phoneDeviceId?: string;
  };
  if (!sessionId || !phoneDeviceId) {
    return NextResponse.json(
      { error: 'sessionId and phoneDeviceId required' },
      { status: 400 },
    );
  }

  const active = await getActiveSessionForUser(payload.uid);
  if (
    !active.currentlyStudying ||
    !active.currentSessionId ||
    active.currentSessionId !== sessionId
  ) {
    return NextResponse.json(
      { error: 'sessionId is not the active desktop session for this account' },
      { status: 409 },
    );
  }

  const pairing = await autoClaimPairing({
    userId: payload.uid,
    sessionId,
    phoneDeviceId,
  });

  return NextResponse.json({
    sessionId: pairing.sessionId,
    userId: pairing.userId,
    claimedAt: pairing.claimedAt ?? Date.now(),
  });
}
