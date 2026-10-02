const EMPTY = '—';

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return EMPTY;
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return EMPTY;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return EMPTY;
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const future = diff < 0;
  const s = Math.abs(diff);
  const units: [number, string][] = [[60, 'second'], [60, 'minute'], [24, 'hour'], [30, 'day'], [12, 'month'], [Infinity, 'year']];
  let value = s;
  for (const [step, unit] of units) {
    if (value < step) {
      const n = Math.max(1, Math.floor(value));
      if (unit === 'second' && !future) return 'just now';
      const label = `${n} ${unit}${n === 1 ? '' : 's'}`;
      return future ? `in ${label}` : `${label} ago`;
    }
    value /= step;
  }
  return fmtDateTime(iso);
}

/** ISO (UTC) -> value for <input type="datetime-local"> in the browser's timezone. */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value -> ISO (UTC), or null when empty. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/** "FLAG_ENABLED" -> "Flag enabled" */
export function humanize(value: string): string {
  const s = value.toLowerCase().replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type Tone = 'success' | 'error' | 'warning' | 'info' | 'default';

export function actionTone(action: string): Tone {
  if (/FAILED|DELETED|DISABLED|DEACTIVATION|UNASSIGNED|ARCHIVED/.test(action)) return 'error';
  if (/ROLLBACK|ROTATED|SCHEDULE/.test(action)) return 'warning';
  if (/CREATED|ENABLED|ACTIVATION|ASSIGNED|RESTORED/.test(action)) return 'success';
  if (/LOGIN|LOGOUT|PASSWORD/.test(action)) return 'default';
  return 'info';
}

export const REASON_TEXT: Record<string, string> = {
  FLAG_NOT_FOUND: 'No flag with this key exists.',
  FLAG_ARCHIVED: 'The flag is archived, so it is off everywhere.',
  DISABLED: 'The flag is switched off in this environment.',
  SCHEDULED: 'The flag stays off until its scheduled start time.',
  USER_TARGETED: 'This user is on the include list.',
  USER_EXCLUDED: 'This user is on the exclude list.',
  FULL_ROLLOUT: 'Rollout is 100%, so every user gets the feature.',
  ROLLOUT_INCLUDED: "The user's bucket is below the rollout percentage.",
  ROLLOUT_EXCLUDED: "The user's bucket is at or above the rollout percentage.",
  NO_USER_CONTEXT: 'Partial rollouts need a user ID to decide.',
};

export function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return EMPTY;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return fmtDateTime(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
