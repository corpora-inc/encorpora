// The package's public surface: the contract and the mount, and nothing else.
// A host imports `mount` and hands it an element and a `Host`.

export { mount } from "./contract.ts"
export type { Host, Question } from "./contract.ts"
export { createStubHost } from "./stubHost.ts"
export type { StubHostOptions } from "./stubHost.ts"
