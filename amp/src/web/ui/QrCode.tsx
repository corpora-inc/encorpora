import { useEffect, useMemo, useState } from "react";

type Encoder = typeof import("qrcode");
let encoder: Encoder | null = null;
let loading: Promise<Encoder> | null = null;
/** The library loads once, when something first needs a code. Await it first
 * to draw a whole page of codes at once, as a printed sheet needs. */
export function loadQrEncoder() {
  loading ??= import("qrcode").then((module) => {
    encoder = (module.default ?? module) as Encoder;
    return encoder;
  });
  return loading;
}

/** A QR code as one path, always dark on white: scanners and printers read that
 * in every theme. Holds its box from the first frame, so nothing moves. */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [ready, setReady] = useState(encoder);
  useEffect(() => {
    if (ready) return;
    let current = true;
    void loadQrEncoder()
      .then((loaded) => {
        if (current) setReady(loaded);
      })
      .catch((error) => console.error("QR code could not load", error));
    return () => {
      current = false;
    };
  }, [ready]);
  const drawn = useMemo(() => {
    if (!ready) return null;
    const { modules } = ready.create(value, { errorCorrectionLevel: "M" });
    const quiet = 4;
    let d = "";
    for (let row = 0; row < modules.size; row++)
      for (let col = 0; col < modules.size; col++)
        if (modules.get(row, col))
          d += `M${col + quiet} ${row + quiet}h1v1h-1z`;
    return { d, full: modules.size + quiet * 2 };
  }, [ready, value]);
  return (
    <svg
      className={className}
      viewBox={`0 0 ${drawn?.full ?? 1} ${drawn?.full ?? 1}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
    >
      <rect
        width={drawn?.full ?? 1}
        height={drawn?.full ?? 1}
        fill="var(--color-print-paper)"
      />
      {drawn && <path d={drawn.d} fill="var(--color-print-ink)" />}
    </svg>
  );
}
