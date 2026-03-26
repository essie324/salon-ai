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
  created_at: string;
  updated_at: string;
};

export type OutreachQueueBuckets = {
  /** Items to handle now (or past-due scheduled). Dismissed excluded. */
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
 * Split merged queue into "act now" vs "scheduled later". Dismissed items are omitted from both.
 */
export function partitionOutreachQueueByFollowUp(
  queue: OutreachQueueResult,
  now: Date,
): OutreachQueueBuckets {
  const needsPredicate = (item: OutreachQueueItem) =>
    !isDismissed(item) && !isScheduledFuture(item, now);
  const scheduledPredicate = (item: OutreachQueueItem) =>
    !isDismissed(item) && isScheduledFuture(item, now);

  return {
    needsAction: queueResultFromGroups(filterGroups(queue.groups, needsPredicate)),
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
