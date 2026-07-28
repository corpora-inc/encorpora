// The package surface. A host imports `mount` and hands it an element and a
// `Host`; nothing else here is public API.

export { mount } from "./contract.ts"
export type { Host, Question } from "./contract.ts"
