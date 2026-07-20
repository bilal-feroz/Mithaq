/**
 * Deterministic canonical JSON serialization.
 *
 * Rules:
 *  - Object keys sorted lexicographically at every depth.
 *  - Arrays keep their order.
 *  - `undefined` object values are omitted (like JSON.stringify).
 *  - `undefined` array items serialize as null (like JSON.stringify).
 *  - No insignificant whitespace.
 *
 * Used for audit-event payload hashing so the same logical payload always
 * produces the same bytes, regardless of property insertion order.
 */
export function canonicalJson(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return JSON.stringify(value);
    case "undefined":
      return "null";
    case "object": {
      if (Array.isArray(value)) {
        return `[${value.map((item) => serialize(item)).join(",")}]`;
      }
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort();
      const body = keys
        .map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`)
        .join(",");
      return `{${body}}`;
    }
    default:
      throw new TypeError(`Cannot canonicalize value of type ${typeof value}`);
  }
}
