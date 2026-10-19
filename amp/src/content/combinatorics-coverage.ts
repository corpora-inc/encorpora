import type { FacetMapping } from "./coverage";
export const combinatoricsFacetMappings: readonly FacetMapping[] = [
  [
    "counting-principle",
    "compound-probability.multiplication-principle",
    "Count outcomes of two to four independent stages with two to eight options each (menus, outfits and multi-leg routes) and two- to four-position codes with repeated digits or letters. Does not assess tree or table construction, restricted stages, or probabilities of compound events.",
  ],
  [
    "permutation-count",
    "permutations-combinations.ordered-selections",
    "Count arrangements without repetition: offices from 5 to 12 members, race places from 4 to 10 runners, shelf orders of 3 to 8 books (factorials) and 2 to 4 of 4 to 9 photos in frames. Does not assess repeated items, circular arrangements or restrictions.",
  ],
  [
    "combination-count",
    "permutations-combinations.unordered-selections",
    "Count groups of 2 to 5 from 5 to 14 items and handshakes among 4 to 15 people by dividing arrangements by the orders of a group. Does not assess combinations with repetition or restricted groups.",
  ],
  [
    "combination-probability",
    "permutations-combinations.selection-probability",
    "Find exact probabilities that a random group of 2 to 4 drawn from two kinds (2 to 8 of each) contains all, none or exactly some of one kind. Does not assess sequential draws, conditional probability or more than two kinds.",
  ],
  [
    "independent-events-probability",
    "independent-events.equally-likely-pairs",
    "Find both, neither and at-least-one probabilities for two independent equally likely devices (a number cube, a 3- to 10-section spinner, a coin) using products and complements. Does not assess deciding whether events are independent from data or tables.",
  ],
  [
    "expected-value",
    "expected-value.equally-likely-payoffs",
    "Find the exact expected payout or net gain after a fixed cost for a spinner with 4 to 12 equal sections and two or three positive payoffs. Does not assess unequal probabilities given as decimals, comparing decisions, or variance.",
  ],
].map(([templateId, facetId, rationale]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: rationale!,
}));
