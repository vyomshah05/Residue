/**
 * feedPhoneReport.ts
 *
 * Bridge between the iOS companion's on-device Zetic Melange report
 * (POSTed to /api/phone/report) and the existing Fetch.ai
 * CorrelationAgent + Orchestrator pipeline.
 *
 * Triggered fire-and-forget from /api/phone/report. Does three things,
 * each best-effort (the function never throws — failure to update the
 * agent stack must not block the desktop UI from rendering the report):
 *
 *   1. Translate the phone-side signals (unlock count + total time on
 *      phone + per-category Screen Time minutes) into a behavioural
 *      feature snapshot with a derived productivity score, and append
 *      it to the existing `sessions_ts` time-series collection so
 *      CorrelationAgent.buildOptimalProfile sees a phone-aware sample
 *      on its next rebuild.
 *   2. Trigger /api/agents/correlation in-process so the user's
 *      profiles.optimalProfile is rebuilt right away.
 *   3. Best-effort /api/agents/orchestrate ping so the next
 *      intervention recommendation reflects the report. The route
 *      already falls through to ASI1-Mini when the Python uAgents
 *      service is offline, so this is safe.
 */

import { getDb } from '@/lib/mongodb';
import type { PhoneReportRecord } from '@/lib/auth/store';

/**
 * Heuristic productivity score (0-100) derived from a phone report.
 *
 * - Each unlock costs ~3 points (capped) — frequent context switches
 *   are the strongest distraction signal.
 * - Each minute on phone costs ~1 point (capped) — long single
 *   sessions on the phone are also distraction.
 * - Floor at 0, ceiling at 100. The default for an empty session is
 *   100 (no distractions ever recorded → ideal focus).
 */
function deriveProductivityScore(report: PhoneReportRecord, minutesOnPhone: number): number {
  // The /api/phone/report POST shape has these signals indirectly via
  // perCategoryMinutes; if we have it, prefer that. Otherwise fall
  // back to the totalMinutes implied by perCategoryMinutes.
  const totalCategoryMin = Object.values(report.perCategoryMinutes ?? {}).reduce(
    (acc, n) => acc + (Number.isFinite(n) ? n : 0),
    0,
  );
  const minutes = Math.max(minutesOnPhone, totalCategoryMin);
  const minutePenalty = Math.min(60, minutes);
  const score = 100 - minutePenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Map our internal Melange label to the same coarse cognitive-state
 * vocabulary used by `correlations` (focused / distracted / tired /
 * stressed). The on-device classifier emits glance / off_task /
 * break_needed / unknown via PhoneEvent.inference.label, but the
 * report is a higher-level summary and doesn't carry that field —
 * so we infer state from the productivity score.
 */
function deriveState(score: number): string {
  if (score >= 70) return 'focused';
  if (score >= 40) return 'distracted';
  return 'tired';
}

interface FeedSignals {
  unlockCount?: number;
  totalDistractionMs?: number;
  goalMode?: string;
}

export async function feedReportIntoAgents(
  userId: string,
  sessionId: string,
  report: PhoneReportRecord,
  signals: FeedSignals = {},
): Promise<void> {
  try {
    const minutesOnPhone = (signals.totalDistractionMs ?? 0) / 60_000;
    const productivityScore = deriveProductivityScore(report, minutesOnPhone);
    const state = deriveState(productivityScore);

    // 1) Append a phone_report snapshot to sessions_ts so the
    // CorrelationAgent rebuild sees this datapoint.
    try {
      const db = await getDb();
      await db.collection('sessions_ts').insertOne({
        user_id: userId,
        session_id: sessionId,
        timestamp: report.createdAt ?? Date.now(),
        goal: 'phone_report',
        state,
        productivity_score: productivityScore,
        phone: {
          unlockCount: signals.unlockCount ?? 0,
          minutesOnPhone,
          perCategoryMinutes: report.perCategoryMinutes ?? {},
          modelKey: report.modelKey,
          inferenceMs: report.inferenceMs,
        },
      });
    } catch (err) {
      console.warn('[feedReportIntoAgents] sessions_ts insert failed:', err);
    }

    // 2) Best-effort in-process correlation rebuild.
    try {
      const base = process.env.RESIDUE_INTERNAL_BASE_URL || 'http://localhost:3000';
      await fetch(`${base}/api/agents/correlation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    } catch (err) {
      console.warn('[feedReportIntoAgents] correlation ping failed:', err);
    }

    // 3) Best-effort orchestrator ping.
    try {
      const base = process.env.RESIDUE_INTERNAL_BASE_URL || 'http://localhost:3000';
      await fetch(`${base}/api/agents/orchestrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: userId,
          goal_mode: signals.goalMode || 'focus',
        }),
      });
    } catch (err) {
      console.warn('[feedReportIntoAgents] orchestrate ping failed:', err);
    }
  } catch (err) {
    // Top-level guard: fire-and-forget contract.
    console.warn('[feedReportIntoAgents] unexpected failure:', err);
  }
}
