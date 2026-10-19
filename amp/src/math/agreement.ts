/** Verb forms that agree with an interpolated count ("1 was", "3 were"). */
export const isAre = (n: number) => (n === 1 ? "is" : "are");
export const wasWere = (n: number) => (n === 1 ? "was" : "were");
export const hasHave = (n: number) => (n === 1 ? "has" : "have");
