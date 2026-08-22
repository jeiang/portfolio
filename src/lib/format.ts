const FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(unixSeconds: number | null): string {
  if (unixSeconds === null) return "Draft";
  return FORMATTER.format(new Date(unixSeconds * 1000));
}

/** Machine-readable counterpart for <time datetime>. */
export function isoDate(unixSeconds: number | null): string {
  return unixSeconds === null ? "" : new Date(unixSeconds * 1000).toISOString();
}

/**
 * `<input type="datetime-local">` value. Deliberately UTC (and labelled as
 * such in the form): server and browser can disagree about the local zone,
 * and a post that publishes an hour early is a confusing bug to chase.
 */
export function toDatetimeLocal(unixSeconds: number | null): string {
  if (unixSeconds === null) return "";
  return new Date(unixSeconds * 1000).toISOString().slice(0, 16);
}

export function fromDatetimeLocal(value: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(`${value}:00Z`);
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}
