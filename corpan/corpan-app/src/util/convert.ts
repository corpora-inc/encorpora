export function toCammelCase(val: string): string {
  return val.replace(/-(\w)/g, (_, c) => c.toUpperCase());
}
