export function cn(
  ...classes: (string | false | null | undefined)[]
): string {
  return classes.filter(Boolean).join(" ");
}

export function formatUtcDate(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  return new Date(time).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatUtcDateTime(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  return `${new Date(time).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

export function shortHash(hash: string, length = 12): string {
  return `${hash.slice(0, length)}…`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
