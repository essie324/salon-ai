import type {
  OutreachActionState,
  OutreachQueueGroup,
  OutreachQueueItem,
  OutreachQueueResult,
} from "@/app/lib/outreach/queue";

export type { OutreachActionState };

/** Row shape from `outreach_actions` (Supabase). */
export type OutreachActionRow = {
  id: string;
  outreach_key: string;
  outreach_type: string;
  client_id: string;
  appointment_id: string | null;
  action_state: string;
  scheduled_for: string | null;
  sent_at: string | null;
  is_ready: boolean;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
};

export type OutreachQueueBuckets = {
  /** Items to handle now (or past-due scheduled). Dismissed and sent excluded. */
  needsAction: OutreachQueueResult;
  /** Future scheduled follow-ups only. */
  scheduledFollowUp: OutreachQueueResult;
};

export function isOutreachQueueBucketsEmpty(b: OutreachQueueBuckets): boolean {
  return b.needsAction.isEmpty && b.scheduledFollowUp.isEmpty;
}

export function collectOutreachKeysFromQueue(queue: OutreachQueueResult): string[] {
  return queue.groups.flatMap((g) => g.items.map((i) => i.key));
}

function isDismissed(item: OutreachQueueItem): boolean {
  return item.followUp?.actionState === "dismissed";
}

function isSent(item: OutreachQueueItem): boolean {
  const fu = item.followUp;
  if (!fu) return false;
  if (fu.actionState === "sent") return true;
  if (fu.sentAt) return true;
  return false;
}

function isScheduledFuture(item: OutreachQueueItem, now: Date): boolean {
  const fu = item.followUp;
  if (fu?.actionState !== "scheduled") return false;
  if (!fu.scheduledFor) return false;
  return new Date(fu.scheduledFor).getTime() > now.getTime();
}

function filterGroups(
  groups: OutreachQueueGroup[],
  keep: (item: OutreachQueueItem) => boolean,
): OutreachQueueGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter(keep),
    }))
    .filter((g) => g.items.length > 0);
}

function queueResultFromGroups(groups: OutreachQueueGroup[]): OutreachQueueResult {
  return {
    groups,
    isEmpty: groups.every((g) => g.items.length === 0),
  };
}

function compareNeedsPriority(a: OutreachQueueItem, b: OutreachQueueItem, now: Date): number {
  const pa = needsActionSortRank(a, now);
  const pb = needsActionSortRank(b, now);
  if (pa !== pb) return pa - pb;
  return a.clientName.localeCompare(b.clientName);
}

/** Lower = higher priority in the Needs action bucket. */
function needsActionSortRank(item: OutreachQueueItem, now: Date): number {
  if (item.followUp?.actionState === "ready_to_send") return 0;
  const fu = item.followUp;
  if (fu?.actionState === "scheduled" && fu.scheduledFor) {
    if (new Date(fu.scheduledFor).getTime() <= now.getTime()) return 1;
  }
  return 2;
}

function sortNeedsActionQueue(queue: OutreachQueueResult, now: Date): OutreachQueueResult {
  const groups = queue.groups.map((g) => ({
    ...g,
    items: [...g.items].sort((a, b) => compareNeedsPriority(a, b, now)),
  }));
  return queueResultFromGroups(groups);
}

/**
 * Attach DB rows to queue items by `outreach_key`. Items without a row behave like implicit `new`.
 */
export function mergeOutreachActionsIntoQueue(
  queue: OutreachQueueResult,
  rows: OutreachActionRow[],
): OutreachQueueResult {
  const byKey = new Map(rows.map((r) => [r.outreach_key, r]));
  const attach = (item: OutreachQueueItem): OutreachQueueItem => {
    const row = byKey.get(item.key);
    if (!row) {
      return { ...item, followUp: null };
    }
    return {
      ...item,
      followUp: {
        outreachKey: row.outreach_key,
        actionState: row.action_state as OutreachActionState,
        scheduledFor: row.scheduled_for,
        sentAt: row.sent_at,
        isReady: row.is_ready,
        lastMessagePreview: row.last_message_preview,
      },
    };
  };
  const groups = queue.groups.map((g) => ({
    ...g,
    items: g.items.map(attach),
  }));
  return queueResultFromGroups(groups);
}

/**
 * Split merged queue into "act now" vs "scheduled later".
 * Dismissed and sent items are omitted from both buckets.
 */
export function partitionOutreachQueueByFollowUp(
  queue: OutreachQueueResult,
  now: Date,
): OutreachQueueBuckets {
  const needsPredicate = (item: OutreachQueueItem) =>
    !isDismissed(item) && !isSent(item) && !isScheduledFuture(item, now);
  const scheduledPredicate = (item: OutreachQueueItem) =>
    !isDismissed(item) && !isSent(item) && isScheduledFuture(item, now);

  const needsRaw = queueResultFromGroups(filterGroups(queue.groups, needsPredicate));
  const needsAction = sortNeedsActionQueue(needsRaw, now);

  return {
    needsAction,
    scheduledFollowUp: queueResultFromGroups(filterGroups(queue.groups, scheduledPredicate)),
  };
}

/** Convert HTML date input (YYYY-MM-DD) to a stable ISO timestamp (noon UTC that calendar day). */
export function scheduledForFromDateInput(dateYYYYMMDD: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYYYYMMDD.trim());
  if (!m) throw new Error("Invalid date");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).toISOString();
}

export function formatScheduledForLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
