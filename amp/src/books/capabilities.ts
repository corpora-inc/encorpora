/** Reader features advertised by this application build. */
export const readerCapabilities = [
  "algebra-models-v1",
  "early-number-v1",
  "unit-regions-v1",
] as const;
export function supportsBook(
  required: readonly string[],
  advertised: readonly string[],
): boolean {
  return required.every((capability) => advertised.includes(capability));
}
