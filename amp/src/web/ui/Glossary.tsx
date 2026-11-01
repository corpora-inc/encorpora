import {
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { GlossaryPayload, TermId } from "../../glossary/types";
import {
  blockValue,
  GlossaryBlockContext,
  GlossaryContext,
  type GlossaryValue,
} from "./glossary-context";
import { KEY_WORDS, TermCard } from "./TermCard";

/** Term cards for one payload (a lesson, an answer's explanation, a hint).
 * Every MathText inside a `GlossaryBlock` below links its words to their
 * cards, with no props to thread. A payload without glossary fields (an
 * older server) renders its children unchanged. */
export function GlossaryProvider({
  payload,
  children,
}: {
  payload: GlossaryPayload | null | undefined;
  children: ReactNode;
}) {
  const [opened, setOpened] = useState<{
    id: TermId;
    origin: HTMLElement;
    list?: readonly TermId[];
  } | null>(null);
  const glossary = payload?.glossary;
  const lexicon = payload?.glossaryLexicon;
  const open = useCallback(
    (id: TermId, origin: HTMLElement) => setOpened({ id, origin }),
    [],
  );
  const openList = useCallback(
    (ids: readonly TermId[], origin: HTMLElement) =>
      setOpened({ id: KEY_WORDS, origin, list: ids }),
    [],
  );
  const value = useMemo<GlossaryValue | null>(
    () =>
      glossary?.length && lexicon
        ? {
            cards: new Map(glossary.map((c) => [c.id, c])),
            lexicon,
            open,
            openList,
          }
        : null,
    [glossary, lexicon, open, openList],
  );
  // Always the same tree, so a payload arriving never remounts its texts.
  return (
    <GlossaryContext.Provider value={value}>
      {children}
      {value && opened && (opened.list || value.cards.has(opened.id)) && (
        <TermCard
          key={`${opened.id}`}
          cards={value.cards}
          start={opened.id}
          list={opened.list}
          origin={opened.origin}
          close={() => setOpened(null)}
        />
      )}
    </GlossaryContext.Provider>
  );
}

/** Texts that link only the first use of each term among them. */
export function GlossaryBlock({
  texts,
  children,
}: {
  texts: readonly string[];
  children: ReactNode;
}) {
  const glossary = useContext(GlossaryContext);
  const key = texts.join("\u0000");
  const block = useMemo(
    () => (glossary ? blockValue(texts, glossary) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [glossary, key],
  );
  return (
    <GlossaryBlockContext.Provider value={block}>
      {children}
    </GlossaryBlockContext.Provider>
  );
}

/** One payload whose texts form one block: an explanation list, a hint. */
export function Glossary({
  payload,
  texts,
  children,
}: {
  payload: GlossaryPayload | null | undefined;
  texts: readonly string[];
  children: ReactNode;
}) {
  return (
    <GlossaryProvider payload={payload}>
      <GlossaryBlock texts={texts}>{children}</GlossaryBlock>
    </GlossaryProvider>
  );
}
