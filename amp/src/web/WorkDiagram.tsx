import { Fragment, type CSSProperties, type ReactNode } from "react";
import { MathText, spokenMath } from "./MathText";
import {
  numberTex,
  type WorkAreaPart,
  type WorkDiagram,
  type WorkRef,
  type WorkToken,
} from "../math/structured-work";

/* A fixed build drawn where its entries mean something: an area model with
   each width typed along its side and each area typed inside its region, or
   written lines with each entry in its place ("3 × 5 = [ ]"), or a column
   method with each digit of the result in its column. The entries
   themselves (inputs, keypad, notes, marks) are StructuredWorkInput's; this
   module only places them. Styles live in work-diagram.css. */

type Mark = "correct" | "incorrect" | undefined;
export type DiagramSlots = {
  /** The entry control for one field, named for a screen reader. */
  entry: (ref: WorkRef, name: string) => ReactNode;
  /** The field's text as typed. */
  value: (ref: WorkRef) => string;
  /** The field's row mark after Check. */
  mark: (ref: WorkRef) => Mark;
  /** The field's own label ("Quotient"). */
  label: (ref: WorkRef) => string;
};

function Slot({
  slots,
  at,
  name,
  role,
}: {
  slots: DiagramSlots;
  at: WorkRef;
  name: string;
  role: "side" | "region" | "line" | "column" | "mark";
}) {
  const mark = slots.mark(at);
  return (
    <span className="work-slot" data-role={role} data-mark={mark}>
      {slots.entry(at, name)}
      <span className="work-slot-mark" aria-hidden="true">
        {mark === "correct" ? "✓" : mark === "incorrect" ? "✕" : ""}
      </span>
    </span>
  );
}

/** The learner's entry, repeated where the line adds it up; an empty box
 * until it is typed. */
function Echo({ text }: { text: string }) {
  const v = text.trim();
  if (!v)
    return <span className="work-echo" data-empty="" aria-hidden="true" />;
  return (
    <span className="work-echo">
      {/^-?\d+(?:\.\d+)?$/.test(v) ? (
        <MathText text={`$${numberTex(v)}$`} />
      ) : (
        v
      )}
    </span>
  );
}

/** A line in phrases that never break inside: a long line wraps only before
 * an "=", as typeset mathematics does ("1,823 ÷ 3 = ▢ + ▢ / = [ ] R [ ]"). */
function phrases(tokens: WorkToken[]): WorkToken[][] {
  const out: WorkToken[][] = [];
  for (const t of tokens)
    if (!out.length || ("text" in t && t.text === "=")) out.push([t]);
    else out.at(-1)!.push(t);
  return out;
}

function Phrase({
  tokens,
  slots,
  name,
}: {
  tokens: WorkToken[];
  slots: DiagramSlots;
  name: (at: WorkRef) => string;
}) {
  return (
    <span className="work-phrase">
      {tokens.map((t, n) =>
        "text" in t ? (
          <span key={n} className="work-line-text">
            <MathText text={t.text} />
          </span>
        ) : "field" in t ? (
          <Slot
            key={n}
            slots={slots}
            at={t.field}
            name={name(t.field)}
            role="line"
          />
        ) : (
          <Echo key={n} text={slots.value(t.echo)} />
        ),
      )}
    </span>
  );
}

/** An entry is named by what its line computes ("9 times 5"), with its own
 * label when the line has several. */
function lineNamer(tokens: WorkToken[], slots: DiagramSlots) {
  const head =
    tokens[0] && "text" in tokens[0] ? spokenMath(tokens[0].text) : "";
  const fields = tokens.filter((t) => "field" in t).length;
  return (at: WorkRef) =>
    !head ? slots.label(at) : fields > 1 ? `${head}, ${slots.label(at)}` : head;
}

/** One line under a figure, centred. */
function Line({ tokens, slots }: { tokens: WorkToken[]; slots: DiagramSlots }) {
  const name = lineNamer(tokens, slots);
  return (
    <p className="work-line">
      {phrases(tokens).map((phrase, p) => (
        <Phrase key={p} tokens={phrase} slots={slots} name={name} />
      ))}
    </p>
  );
}

/** Written lines with their "=" signs in one column: what each line
 * computes on the left, the work on the right. */
function Lines({
  lines,
  slots,
}: {
  lines: WorkToken[][];
  slots: DiagramSlots;
}) {
  return (
    <div className="work-lines">
      {lines.map((tokens, n) => {
        const [left, ...right] = phrases(tokens);
        const name = lineNamer(tokens, slots);
        return (
          <Fragment key={n}>
            <span className="work-line-left">
              <Phrase tokens={left!} slots={slots} name={name} />
            </span>
            <span className="work-line-right">
              {right.map((phrase, p) => (
                <Phrase key={p} tokens={phrase} slots={slots} name={name} />
              ))}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

function Side({
  part,
  index,
  axis,
  slots,
}: {
  part: WorkAreaPart;
  index: number;
  axis: "across" | "down";
  slots: DiagramSlots;
}) {
  const style: CSSProperties =
    axis === "across"
      ? { gridRow: 1, gridColumn: index + 2 }
      : { gridRow: index + 2, gridColumn: 1 };
  return (
    <div className="work-area-side" data-axis={axis} style={style}>
      {part.caption && (
        <span className="work-area-caption" aria-hidden="true">
          {part.caption}
        </span>
      )}
      {part.field ? (
        <span className="work-area-dimension">
          <Slot
            slots={slots}
            at={part.field}
            name={`Part ${index + 1} ${part.caption ?? "length"}`}
            role="side"
          />
        </span>
      ) : (
        <span className="work-area-given">
          <MathText
            text={
              /^\d+$/.test(part.given!)
                ? `$${numberTex(part.given!)}$`
                : part.given!
            }
          />
        </span>
      )}
      {/* A printed length stands beside a line as long as its part. */}
      {!part.field && (
        <span
          className="work-area-dimension"
          data-axis={axis}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/** What a screen reader calls a region's entry: "30 × 70" between printed
 * sides, else its place ("Part 2 area"). */
function regionName(
  d: Extract<WorkDiagram, { kind: "area" }>,
  j: number,
  i: number,
) {
  const across = d.across[i]!.given,
    down = d.down[j]!.given;
  if (across && down && d.down.length > 1) return `${down} × ${across}`;
  const caption = d.regions[j]![i]?.caption ?? "region";
  return d.across.length > 1 ? `Part ${i + 1} ${caption}` : caption;
}

function AreaModel({
  d,
  slots,
}: {
  d: Extract<WorkDiagram, { kind: "area" }>;
  slots: DiagramSlots;
}) {
  // Entries follow the work: a width, then the area under it; or, with
  // printed sides, the regions row by row.
  const byColumn = d.across.some((p) => p.field);
  const region = (j: number, i: number) => {
    const at = d.regions[j]![i];
    return (
      <div
        key={`r${j}-${i}`}
        className="work-area-region"
        data-tone={(i + j) % 3}
        data-first-column={i === 0 ? "" : undefined}
        data-first-row={j === 0 ? "" : undefined}
        style={{ gridRow: j + 2, gridColumn: i + 2 }}
      >
        {at && (
          <>
            {at.caption && (
              <span className="work-area-caption" aria-hidden="true">
                {at.caption}
              </span>
            )}
            <Slot
              slots={slots}
              at={at.field}
              name={regionName(d, j, i)}
              role="region"
            />
          </>
        )}
      </div>
    );
  };
  const across = d.across.map((part, i) => (
    <Side key={`a${i}`} part={part} index={i} axis="across" slots={slots} />
  ));
  const down = d.down.map((part, j) => (
    <Side key={`d${j}`} part={part} index={j} axis="down" slots={slots} />
  ));
  const cells = byColumn
    ? [
        ...down,
        ...d.across.flatMap((_, i) => [
          across[i],
          ...d.down.map((_, j) => region(j, i)),
        ]),
      ]
    : [
        ...across,
        ...d.down.flatMap((_, j) => [
          down[j],
          ...d.across.map((_, i) => region(j, i)),
        ]),
      ];
  const sides = (parts: WorkAreaPart[]) =>
    parts.map((p) => p.given ?? "?").join(" and ");
  return (
    <div className="work-diagram" data-kind="area">
      <div
        className="work-area"
        role="group"
        aria-label={`Area model, ${sides(d.down)} tall, in ${d.across.length} ${d.across.length === 1 ? "part" : "parts"}`}
        style={{
          gridTemplateColumns: `auto ${d.across
            .map((p) => `minmax(var(--work-part-min), ${p.size}fr)`)
            .join(" ")}`,
          // Rows have no set height to share, so a smaller part is drawn
          // shorter instead.
          gridTemplateRows: `auto ${d.down
            .map(
              (p) =>
                `minmax(calc(var(--work-region-min) * ${p.size === Math.max(...d.down.map((x) => x.size)) ? 1 : 0.8}), auto)`,
            )
            .join(" ")}`,
        }}
      >
        {cells}
        {/* The rectangle's outline, over the regions' shared edges. */}
        <span className="work-area-outline" aria-hidden="true" />
      </div>
      {d.lines?.map((tokens, n) => (
        <Line key={n} tokens={tokens} slots={slots} />
      ))}
    </div>
  );
}

/** A written column method: the numbers one digit to a column, points
 * aligned, the sign before the last line, a rule, and an entry for each
 * digit of the result in its own column. Where regrouping changes a
 * column, an entry above it takes the new top value, and in a subtraction
 * the top digit it replaces is struck through, as on paper. */
function ColumnMethod({
  d,
  slots,
}: {
  d: Extract<WorkDiagram, { kind: "columns" }>;
  slots: DiagramSlots;
}) {
  const point = (c: number) => d.lines.some((l) => l[c] === ".");
  const columns = `var(--work-sign) ${d.answer
    .map((_, c) => (point(c) ? "var(--work-point)" : "var(--work-digit)"))
    .join(" ")}`;
  const subtract = d.operation === "−";
  const spoken = (l: string[]) => l.join("");
  return (
    <div className="work-diagram" data-kind="columns">
      <div
        className="work-column-method"
        role="group"
        aria-label={`${spoken(d.lines[0]!)} ${subtract ? "minus" : "plus"} ${spoken(d.lines.at(-1)!)}, in columns`}
        style={{ gridTemplateColumns: columns }}
      >
        {d.marks.some(Boolean) && (
          <>
            <span />
            {d.marks.map((m, c) =>
              m ? (
                <Slot
                  key={`m${c}`}
                  slots={slots}
                  at={m.field}
                  name={slots.label(m.field)}
                  role="mark"
                />
              ) : (
                <span key={`m${c}`} />
              ),
            )}
          </>
        )}
        {d.lines.map((line, n) => (
          <Fragment key={`l${n}`}>
            <span className="work-column-sign" aria-hidden="true">
              {n === d.lines.length - 1 ? d.operation : ""}
            </span>
            {line.map((ch, c) => (
              <span
                key={c}
                className="work-column-digit"
                aria-hidden="true"
                data-struck={subtract && n === 0 && d.marks[c] ? "" : undefined}
              >
                {ch}
              </span>
            ))}
          </Fragment>
        ))}
        <span className="work-column-rule" aria-hidden="true" />
        <span />
        {d.answer.map((cell, c) =>
          "field" in cell ? (
            <Slot
              key={`a${c}`}
              slots={slots}
              at={cell.field}
              name={slots.label(cell.field)}
              role="column"
            />
          ) : (
            <span
              key={`a${c}`}
              className="work-column-digit"
              aria-hidden="true"
            >
              {cell.given}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

/** A diagram in place of the list of rows. */
export function WorkDiagramView({
  diagram,
  slots,
}: {
  diagram: WorkDiagram;
  slots: DiagramSlots;
}) {
  if (diagram.kind === "area") return <AreaModel d={diagram} slots={slots} />;
  if (diagram.kind === "columns")
    return <ColumnMethod d={diagram} slots={slots} />;
  return (
    <div className="work-diagram" data-kind="lines">
      <Lines lines={diagram.lines} slots={slots} />
    </div>
  );
}
