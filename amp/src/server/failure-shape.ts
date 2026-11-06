/** What failed, for a job's log: never the message, which can carry a payload. */
export function failureShape(error: unknown) {
  const source = (error ?? {}) as {
    name?: unknown;
    code?: unknown;
    status?: unknown;
  };
  const safe = (value: unknown) =>
    typeof value === "number" ||
    (typeof value === "string" && /^[\w.-]{1,64}$/.test(value))
      ? value
      : undefined;
  return JSON.stringify({
    name: safe(source.name),
    code: safe(source.code),
    status: safe(source.status),
  });
}
