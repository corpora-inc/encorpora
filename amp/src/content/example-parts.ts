// Shared by the server's lesson payload and the client's lesson view, so it
// imports nothing.

/** A multi-part example as the lesson shows it: its sentence with numbered
 * blanks (`blank` counts from 1), then each blank's label and options. When
 * every blank offers the same options, or the blanks share one set of cards,
 * `options` lists them once and the blanks carry none. */
export type ExampleParts = {
  sentence?: ({ text: string } | { blank: number })[];
  blanks: { label: string; options?: string[] }[];
  options?: string[];
};

/** Every text an example's parts show, in reading order. */
export function examplePartsTexts(parts: ExampleParts | undefined): string[] {
  if (!parts) return [];
  return [
    ...(parts.sentence ?? []).flatMap((part) =>
      "text" in part ? [part.text] : [],
    ),
    ...parts.blanks.flatMap((blank) => [blank.label, ...(blank.options ?? [])]),
    ...(parts.options ?? []),
  ];
}
