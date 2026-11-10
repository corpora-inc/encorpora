import { useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Menu, MenuItem } from "./Menu";
import { ariaSort, SortHeader } from "./SortHeader";
import styles from "./DataGrid.module.css";

export type GridSort = {
  column: string;
  direction: "ascending" | "descending";
};

export type DataGridColumn<Row> = {
  id: string;
  /** The column's name: a real sort button when `compare` is set. */
  header: string;
  /** Under the name in the header: a scale, a unit. Decorative. */
  headerDetail?: ReactNode;
  /** The smallest this column may be, in px; spare room is shared out. */
  width: number;
  align?: "start" | "end";
  compare?: (a: Row, b: Row) => number;
  /** The first direction a click sorts in. */
  firstSort?: GridSort["direction"];
  cell: (row: Row) => ReactNode;
  /** The cell in words, when `cell` draws something visual. */
  cellLabel?: (row: Row) => string;
};

/** Everything a keyboard can land on inside a cell. */
const WIDGETS =
  "a[href],button,input,textarea,[role=button],[role=spinbutton],[role=checkbox]";
const isField = (element: EventTarget | null) =>
  element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;

/**
 * A table for real work. The header and first column stay in view; columns
 * sort from real buttons; arrow keys walk the cells (Home, End, Page keys too),
 * Enter opens the row, and in a text field Up, Down and Enter move through the
 * column as in a spreadsheet, with Escape returning to the cell. Above
 * `virtualizeAbove` rows only the visible rows are in the page. Below
 * `cardsBelow` px each row becomes a stacked card, never a sideways scroll.
 */
export function DataGrid<Row>({
  label,
  columns,
  rows,
  rowKey,
  sort: controlledSort,
  defaultSort,
  onSortChange,
  onRowActivate,
  card,
  cardsBelow = 640,
  cardLayout = "card",
  cardsToolbar,
  cardsHeader,
  cardsSort = true,
  cardEstimate = 120,
  virtualizeAbove = 100,
  rowHeight = 44,
  rules = true,
  className = "",
}: {
  /** Names the grid for assistive technology. */
  label: string;
  columns: readonly DataGridColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  sort?: GridSort | null;
  defaultSort?: GridSort;
  onSortChange?: (sort: GridSort) => void;
  /** Clicking a row, or Enter on a plain cell. */
  onRowActivate?: (row: Row) => void;
  /** One row at narrow widths. By default: the first column, then the rest
   * as labelled values. */
  card?: (row: Row) => ReactNode;
  cardsBelow?: number;
  /** `row`: flush one-line rows, with no gap between them. `list`: flush
   * rows of any height, a hairline between them, never a box. */
  cardLayout?: "card" | "row" | "list";
  /** Beside the sort control above the cards: another way to view them. */
  cardsToolbar?: ReactNode;
  /** Directly above the cards: a key or scale for what they draw. */
  cardsHeader?: ReactNode;
  /** A sort control above the cards, since they have no header to click. */
  cardsSort?: boolean;
  cardEstimate?: number;
  virtualizeAbove?: number;
  rowHeight?: number;
  /** A hairline between rows. */
  rules?: boolean;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );
  // Before paint, so a phone never sees the table first.
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const [ownSort, setOwnSort] = useState<GridSort | null>(defaultSort ?? null);
  const sort = controlledSort === undefined ? ownSort : controlledSort;
  const sorted = useMemo(() => {
    const column = columns.find((c) => c.id === sort?.column);
    if (!column?.compare) return rows;
    const factor = sort?.direction === "descending" ? -1 : 1;
    return [...rows].sort((a, b) => factor * column.compare!(a, b));
  }, [rows, columns, sort?.column, sort?.direction]);
  const sortBy = (column: DataGridColumn<Row>) => {
    const next: GridSort = {
      column: column.id,
      direction:
        sort?.column === column.id
          ? sort.direction === "ascending"
            ? "descending"
            : "ascending"
          : (column.firstSort ?? "ascending"),
    };
    setOwnSort(next);
    onSortChange?.(next);
  };

  const asCards = width < cardsBelow;
  const virtual = rows.length > virtualizeAbove;
  const sortable = cardsSort ? columns.filter((column) => column.compare) : [];
  const current = columns.find((column) => column.id === sort?.column);
  const style = { "--level-row": `${rowHeight}px` } as CSSProperties;

  return (
    <div
      ref={root}
      className={`${styles.root} ${className}`}
      data-grid-mode={asCards ? "cards" : "table"}
      style={style}
    >
      {asCards ? (
        <>
          {(sortable.length > 0 || cardsToolbar) && (
            <div className={styles.cardsBar}>
              {cardsToolbar}
              {sortable.length > 0 && (
                <Menu
                  align="start"
                  label={current ? `Sorted by ${current.header}` : "Sort"}
                >
                  {sortable.map((column) => (
                    <MenuItem key={column.id} onSelect={() => sortBy(column)}>
                      {column.header}
                    </MenuItem>
                  ))}
                </Menu>
              )}
            </div>
          )}
          {cardsHeader}
          <Cards
            label={label}
            rows={sorted}
            rowKey={rowKey}
            columns={columns}
            card={card}
            layout={cardLayout}
            virtual={virtual}
            estimate={cardLayout === "row" ? rowHeight : cardEstimate}
          />
        </>
      ) : (
        <Table
          label={label}
          columns={columns}
          rows={sorted}
          rowKey={rowKey}
          sort={sort}
          onSort={sortBy}
          onRowActivate={onRowActivate}
          available={width}
          virtual={virtual}
          rowHeight={rowHeight}
          rules={rules}
        />
      )}
    </div>
  );
}

function Table<Row>({
  label,
  columns,
  rows,
  rowKey,
  sort,
  onSort,
  onRowActivate,
  available,
  virtual,
  rowHeight,
  rules,
}: {
  label: string;
  columns: readonly DataGridColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  sort: GridSort | null;
  onSort: (column: DataGridColumn<Row>) => void;
  onRowActivate?: (row: Row) => void;
  available: number;
  virtual: boolean;
  rowHeight: number;
  rules: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const [active, setActive] = useState({ r: 0, c: 0 });
  const pending = useRef<{ r: number; c: number } | null>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    enabled: virtual,
    getScrollElement: () => scroller.current,
    estimateSize: () => rowHeight,
    overscan: 8,
    scrollPaddingStart: 72,
  });
  const items = virtual ? virtualizer.getVirtualItems() : [];
  const shown = virtual
    ? items.map((item) => ({ row: rows[item.index]!, index: item.index }))
    : rows.map((row, index) => ({ row, index }));
  const before = virtual ? (items[0]?.start ?? 0) : 0;
  const after = virtual
    ? virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0)
    : 0;

  // One tab stop: the active cell or the first control in it. Runs after every
  // commit, because sorting and virtualization replace rows.
  useLayoutEffect(() => {
    const element = table.current;
    if (!element) return;
    let found = false;
    for (const cell of element.querySelectorAll<HTMLElement>("[data-c]")) {
      const here =
        Number(cell.dataset.r) === active.r &&
        Number(cell.dataset.c) === active.c;
      const widgets = cell.querySelectorAll<HTMLElement>(WIDGETS);
      cell.tabIndex = here && widgets.length === 0 ? 0 : -1;
      for (const widget of widgets) widget.tabIndex = here ? 0 : -1;
      if (here) found = true;
    }
    if (!found) setActive({ r: 0, c: active.c });
    const target = pending.current;
    if (!target) return;
    const cell = element.querySelector<HTMLElement>(
      `[data-r="${target.r}"][data-c="${target.c}"]`,
    );
    if (!cell) return;
    pending.current = null;
    const focusable = cell.querySelector<HTMLElement>(WIDGETS) ?? cell;
    focusable.focus({ preventScroll: !virtual });
    if (focusable instanceof HTMLInputElement) focusable.select();
  });

  const moveTo = (next: { r: number; c: number }) => {
    const target = {
      r: Math.max(0, Math.min(rows.length, next.r)),
      c: Math.max(0, Math.min(columns.length - 1, next.c)),
    };
    pending.current = target;
    setActive(target);
    if (virtual && target.r > 0) virtualizer.scrollToIndex(target.r - 1);
    else if (target.r === 0) scroller.current?.scrollTo({ top: 0 });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLElement>("[data-c]");
    if (!cell) return;
    const r = Number(cell.dataset.r),
      c = Number(cell.dataset.c),
      field = isField(target),
      jump = event.ctrlKey || event.metaKey;
    let next: { r: number; c: number } | undefined;
    switch (event.key) {
      case "ArrowUp":
        next = { r: r - 1, c };
        break;
      case "ArrowDown":
        next = { r: r + 1, c };
        break;
      case "ArrowLeft":
        if (!field) next = { r, c: c - 1 };
        break;
      case "ArrowRight":
        if (!field) next = { r, c: c + 1 };
        break;
      case "Home":
        if (!field) next = { r: jump ? 0 : r, c: 0 };
        break;
      case "End":
        if (!field) next = { r: jump ? rows.length : r, c: columns.length - 1 };
        break;
      case "PageUp":
        next = { r: r - 10, c };
        break;
      case "PageDown":
        next = { r: r + 10, c };
        break;
      case "Enter":
        if (field) next = { r: r + 1, c };
        else if (target === cell && r > 0) {
          event.preventDefault();
          onRowActivate?.(rows[r - 1]!);
        }
        break;
      case "Escape":
        if (field) {
          event.preventDefault();
          cell.focus();
        }
        break;
    }
    if (!next) return;
    event.preventDefault();
    moveTo(next);
  };

  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const scrolls = totalWidth > available;
  return (
    <div
      ref={scroller}
      className={styles.scroller}
      data-scrolls={scrolls || undefined}
      data-virtual={virtual || undefined}
    >
      <table
        ref={table}
        role="grid"
        aria-label={label}
        aria-rowcount={rows.length + 1}
        aria-colcount={columns.length}
        className={`${styles.table} ${rules ? styles.rules : ""}`}
        style={{ minWidth: totalWidth }}
        onKeyDown={onKeyDown}
        onFocus={(event) => {
          const cell = (event.target as HTMLElement).closest<HTMLElement>(
            "[data-c]",
          );
          if (!cell) return;
          const r = Number(cell.dataset.r),
            c = Number(cell.dataset.c);
          if (r !== active.r || c !== active.c) setActive({ r, c });
        }}
      >
        <colgroup>
          {columns.map((column) => (
            <col key={column.id} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr role="row" aria-rowindex={1}>
            {columns.map((column, c) => {
              const sorted = sort?.column === column.id;
              return (
                <th
                  key={column.id}
                  scope="col"
                  role="columnheader"
                  aria-colindex={c + 1}
                  aria-sort={ariaSort(
                    !!column.compare,
                    sorted ? sort!.direction : undefined,
                  )}
                  data-r={0}
                  data-c={c}
                  data-align={column.align}
                  className={`${styles.columnHeader} ${c === 0 ? styles.first : ""}`}
                >
                  {column.compare ? (
                    <SortHeader
                      label={column.header}
                      direction={sorted ? sort!.direction : undefined}
                      align={column.align}
                      onSort={() => onSort(column)}
                    />
                  ) : (
                    <span className={styles.headerText}>{column.header}</span>
                  )}
                  {column.headerDetail !== undefined && (
                    <span className={styles.headerDetail}>
                      {column.headerDetail}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {before > 0 && (
            <tr aria-hidden="true">
              <td
                colSpan={columns.length}
                className={styles.spacer}
                style={{ height: before }}
              />
            </tr>
          )}
          {shown.map(({ row, index }) => (
            <tr
              key={rowKey(row)}
              role="row"
              aria-rowindex={index + 2}
              data-activates={onRowActivate ? true : undefined}
              onClick={
                onRowActivate
                  ? (event: MouseEvent) => {
                      if (
                        (event.target as HTMLElement).closest(WIDGETS) ||
                        getSelection()?.toString()
                      )
                        return;
                      onRowActivate(row);
                    }
                  : undefined
              }
            >
              {columns.map((column, c) => {
                const Cell = c === 0 ? "th" : "td";
                return (
                  <Cell
                    key={column.id}
                    scope={c === 0 ? "row" : undefined}
                    role={c === 0 ? "rowheader" : "gridcell"}
                    aria-colindex={c + 1}
                    aria-label={column.cellLabel?.(row)}
                    data-r={index + 1}
                    data-c={c}
                    data-align={column.align}
                    className={`${styles.cell} ${c === 0 ? styles.first : ""}`}
                    style={{ height: rowHeight }}
                  >
                    {column.cell(row)}
                  </Cell>
                );
              })}
            </tr>
          ))}
          {after > 0 && (
            <tr aria-hidden="true">
              <td
                colSpan={columns.length}
                className={styles.spacer}
                style={{ height: after }}
              />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function DefaultCard<Row>({
  row,
  columns,
}: {
  row: Row;
  columns: readonly DataGridColumn<Row>[];
}) {
  const [first, ...rest] = columns;
  return (
    <>
      <div className={styles.cardTitle}>{first?.cell(row)}</div>
      <dl className={styles.cardFields}>
        {rest.map((column) => (
          <div key={column.id} className={styles.cardField}>
            <dt>{column.header}</dt>
            <dd>{column.cell(row)}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function Cards<Row>({
  label,
  rows,
  rowKey,
  columns,
  card,
  layout,
  virtual,
  estimate,
}: {
  label: string;
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  columns: readonly DataGridColumn<Row>[];
  card?: (row: Row) => ReactNode;
  layout: "card" | "row" | "list";
  virtual: boolean;
  estimate: number;
}) {
  const body = (row: Row) =>
    card ? card(row) : <DefaultCard row={row} columns={columns} />;
  const className = `${styles.cards} ${layout === "row" ? styles.cardRows : layout === "list" ? styles.cardList : ""}`;
  if (virtual)
    return (
      <WindowedCards
        label={label}
        rows={rows}
        rowKey={rowKey}
        body={body}
        className={className}
        estimate={estimate}
      />
    );
  return (
    <ul className={className} aria-label={label}>
      {rows.map((row) => (
        <li key={rowKey(row)} className={styles.card}>
          {body(row)}
        </li>
      ))}
    </ul>
  );
}

/** A long list of cards scrolls with the page; only those near view exist. */
function WindowedCards<Row>({
  label,
  rows,
  rowKey,
  body,
  className,
  estimate,
}: {
  label: string;
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  body: (row: Row) => ReactNode;
  className: string;
  estimate: number;
}) {
  const list = useRef<HTMLUListElement>(null);
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => {
    const top = list.current?.getBoundingClientRect().top ?? 0;
    setMargin(top + window.scrollY);
  }, []);
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => estimate,
    overscan: 6,
    scrollMargin: margin,
  });
  return (
    <ul
      ref={list}
      className={`${className} ${styles.windowed}`}
      aria-label={label}
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((item) => (
        <li
          key={rowKey(rows[item.index]!)}
          ref={virtualizer.measureElement}
          data-index={item.index}
          className={styles.windowedItem}
          style={{
            transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
          }}
        >
          <div className={styles.card}>{body(rows[item.index]!)}</div>
        </li>
      ))}
    </ul>
  );
}
