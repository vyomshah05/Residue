import { NextRequest, NextResponse } from 'next/server';

import { createAuthToken } from '@/lib/auth/tokens';
import {
  claimPairing,
  findPairingByCode,
  findUserById,
} from '@/lib/auth/store';

/**
 * POST /api/pair/code-login
 *
 * Sign-in-by-pairing-code for the iOS companion. The desktop user
 * presses "Generate pairing code" (which calls /api/pair/start with
 * the desktop bearer token) and then types the 6-digit code on the
 * phone. This route lets the phone authenticate AND bind to the
 * desktop session in a single call — the user never has to enter
 * their account password on the phone.
 *
 * Body: { code: string, phoneDeviceId: string }
 * Auth: NONE — the 6-digit code IS the auth factor (it was minted
 * from a privileged desktop session and has a 10-minute TTL).
 *
 * Returns: { token, user: { uid, email }, sessionId, claimedAt }
 *   - `token` is a fresh 30-day Residue auth JWT scoped to the
 *     desktop user's `uid`. The phone persists it like the one it
 *     would get from /api/auth/login.
 *   - `sessionId` is the desktop study session this pairing already
 *     references; the phone treats this as `pairedSessionId` and
 *     starts the lifecycle monitor immediately.
 */
export async function POST(req: NextRequest) {
  let body: { code?: string; phoneDeviceId?: string };
  try {
    body = (await req.json()) as { code?: string; phoneDeviceId?: string };
  } catch {
    body = {};
  }
  const code = body.code?.trim();
  const phoneDeviceId = body.phoneDeviceId?.trim();
  if (!code || !phoneDeviceId) {
    return NextResponse.json(
      { error: 'code and phoneDeviceId required' },
      { status: 400 },
    );
  }

  const pairing = await findPairingByCode(code);
  if (!pairing) {
    return NextResponse.json({ error: 'invalid code' }, { status: 404 });
  }
  if (pairing.expiresAt < Date.now()) {
    return NextResponse.json({ error: 'pairing code expired' }, { status: 410 });
  }

  const user = await findUserById(pairing.userId);
  if (!user) {
    return NextResponse.json(
      { error: 'pairing references unknown user' },
      { status: 410 },
    );
  }

  const claimed = await claimPairing(code, phoneDeviceId);
  if (!claimed) {
    return NextResponse.json(
      { error: 'failed to claim pairing' },
      { status: 500 },
    );
  }

  const token = createAuthToken(user._id, user.email);
  return NextResponse.json({
    token,
    user: { uid: user._id, email: user.email },
    sessionId: claimed.sessionId,
    claimedAt: claimed.claimedAt,
  });
}
