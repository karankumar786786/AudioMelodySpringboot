"use client";

/**
 * Small SVG charts for the analytics pages. The admin UI is dark only, so the dark steps
 * of the reference data-viz palette are used (validated on the zinc-900 surface):
 * categorical blue / orange / aqua, a one-hue blue ramp for magnitude, and the fixed
 * status colours (always with an icon and label, never colour alone).
 */

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export const SERIES = ["#3987e5", "#d95926", "#199e70"] as const;
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;
const GRID = "rgba(255,255,255,0.06)";
const AXIS_TEXT = "#a1a1aa";
const EMPTY_CELL = "#1f1f23";
/** Blue ramp, dark surface: low values recede toward the surface, high values brighten. */
const RAMP = [
  "#0d366b",
  "#104281",
  "#184f95",
  "#1c5cab",
  "#256abf",
  "#2a78d6",
  "#3987e5",
  "#5598e7",
  "#6da7ec",
  "#86b6ef",
  "#9ec5f4",
  "#b7d3f6",
];

/** Colour for value/max on the sequential ramp; 0 is an empty cell. */
export function rampColor(value: number, max: number): string {
  if (!max || value <= 0) return EMPTY_CELL;
  const t = Math.min(1, value / max);
  return RAMP[Math.min(RAMP.length - 1, Math.floor(t * RAMP.length))];
}

function useWidth<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  number,
] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function fmtPct(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function Tooltip({
  x,
  y,
  width,
  children,
}: {
  x: number;
  y: number;
  width: number;
  children: ReactNode;
}) {
  const left = Math.min(Math.max(8, x + 12), Math.max(8, width - 188));
  return (
    <div
      className="pointer-events-none absolute z-10 w-44 rounded-lg border border-white/10 bg-zinc-950/95 px-3 py-2 text-[11px] text-zinc-200 shadow-xl"
      style={{ left, top: Math.max(0, y - 8) }}
    >
      {children}
    </div>
  );
}

export function Legend({
  items,
}: {
  items: { label: string; color: string; dashed?: boolean }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-400">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line
              x1="0"
              x2="16"
              y1="4"
              y2="4"
              stroke={i.color}
              strokeWidth="2"
              strokeDasharray={i.dashed ? "3 3" : undefined}
            />
          </svg>
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ---- line chart --------------------------------------------------------------------------

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
}

/** Lines over a shared x (one y axis). Hover: crosshair plus a tooltip with every series. */
export function LineChart({
  x,
  series,
  height = 200,
  formatX = (v) => String(v),
  formatY = (v) => fmtNum(v),
  yMax,
  onPick,
  markers,
  ariaLabel,
}: {
  x: (string | number)[];
  series: LineSeries[];
  height?: number;
  formatX?: (v: string | number) => string;
  formatY?: (v: number) => string;
  yMax?: number;
  onPick?: (index: number) => void;
  markers?: { index: number; label: string }[];
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 12, t: 10, b: 22 };
  const w = Math.max(0, width - pad.l - pad.r);
  const h = height - pad.t - pad.b;
  const all = series.flatMap((s) =>
    s.values.filter((v): v is number => v !== null),
  );
  const max = yMax ?? niceMax(Math.max(0, ...all));
  const n = x.length;
  const px = (i: number) => pad.l + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const py = (v: number) => pad.t + h - (Math.min(v, max) / max) * h;
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const labelEvery = Math.max(
    1,
    Math.ceil(n / Math.max(1, Math.floor(w / 70))),
  );

  const onMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const rel = (e.clientX - rect.left) / Math.max(1, rect.width);
      setHover(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
    },
    [n],
  );

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && n > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.l}
                x2={pad.l + w}
                y1={py(t)}
                y2={py(t)}
                stroke={GRID}
              />
              <text
                x={pad.l - 6}
                y={py(t)}
                fill={AXIS_TEXT}
                fontSize="10"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatY(t)}
              </text>
            </g>
          ))}
          {x.map((v, i) =>
            i % labelEvery === 0 ? (
              <text
                key={`x-${String(v)}`}
                x={px(i)}
                y={height - 6}
                fill={AXIS_TEXT}
                fontSize="10"
                textAnchor="middle"
              >
                {formatX(v)}
              </text>
            ) : null,
          )}
          {markers?.map((m) => (
            <line
              key={`m-${m.index}`}
              x1={px(m.index)}
              x2={px(m.index)}
              y1={pad.t}
              y2={pad.t + h}
              stroke="#ffffff33"
              strokeDasharray="2 3"
            />
          ))}
          {series.map((s) => {
            let d = "";
            s.values.forEach((v, i) => {
              if (v === null) return;
              d += `${d && s.values[i - 1] !== null ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`;
            });
            return (
              <path
                key={s.key}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeDasharray={s.dashed ? "4 3" : undefined}
              />
            );
          })}
          {hover !== null && (
            <g>
              <line
                x1={px(hover)}
                x2={px(hover)}
                y1={pad.t}
                y2={pad.t + h}
                stroke="#ffffff55"
              />
              {series.map((s) =>
                s.values[hover] !== null && s.values[hover] !== undefined ? (
                  <circle
                    key={s.key}
                    cx={px(hover)}
                    cy={py(s.values[hover] as number)}
                    r="4"
                    fill={s.color}
                    stroke="#18181b"
                    strokeWidth="2"
                  />
                ) : null,
              )}
            </g>
          )}
          {/* Pointer layer; the same values are in the page's tables and buttons. */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: hover/click target over the plot */}
          <rect
            x={pad.l}
            y={pad.t}
            width={w}
            height={h}
            fill="transparent"
            style={{ cursor: onPick ? "pointer" : "crosshair" }}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            onClick={() => hover !== null && onPick?.(hover)}
          />
        </svg>
      )}
      {hover !== null && width > 0 && (
        <Tooltip x={px(hover)} y={pad.t} width={width}>
          <div className="mb-1 font-semibold text-white">
            {formatX(x[hover])}
          </div>
          {series.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between gap-2"
            >
              <span className="inline-flex items-center gap-1.5 text-zinc-400">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                />
                {s.label}
              </span>
              <span className="tabular-nums">
                {s.values[hover] === null
                  ? "–"
                  : formatY(s.values[hover] as number)}
              </span>
            </div>
          ))}
          {onPick && (
            <div className="mt-1 text-zinc-500">Click to play from here</div>
          )}
        </Tooltip>
      )}
    </div>
  );
}

// ---- heat strip (one row of cells, e.g. listens per second) ---------------------------

export function HeatStrip({
  values,
  height = 44,
  label,
  formatCell,
  onPick,
  highlights,
  playhead,
}: {
  values: number[];
  height?: number;
  label: string;
  formatCell: (i: number) => ReactNode;
  onPick?: (i: number) => void;
  highlights?: { start: number; end: number }[];
  playhead?: number | null;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = values.length;
  const max = Math.max(0, ...values);
  const cw = n ? width / n : 0;
  return (
    <div ref={ref} className="relative w-full" style={{ height: height + 10 }}>
      {width > 0 && n > 0 && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: hook buttons below give keyboard access to the same seeks
        <svg
          width={width}
          height={height + 10}
          role="img"
          aria-label={label}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setHover(
              Math.max(
                0,
                Math.min(
                  n - 1,
                  Math.floor(((e.clientX - rect.left) / rect.width) * n),
                ),
              ),
            );
          }}
          onMouseLeave={() => setHover(null)}
          onClick={() => hover !== null && onPick?.(hover)}
          style={{ cursor: onPick ? "pointer" : "default" }}
        >
          {values.map((v, i) => (
            // Cells touch at one-second resolution; the strip reads as a continuous band.
            <rect
              key={`s-${i}-${v}`}
              x={i * cw}
              y={4}
              width={Math.max(cw, 0.5) + 0.4}
              height={height}
              fill={rampColor(v, max)}
            />
          ))}
          {highlights?.map((hl) => (
            <rect
              key={`h-${hl.start}`}
              x={hl.start * cw}
              y={1}
              width={(hl.end - hl.start) * cw}
              height={height + 6}
              fill="none"
              stroke={SERIES[1]}
              strokeWidth="2"
              rx="3"
            />
          ))}
          {playhead !== null &&
            playhead !== undefined &&
            playhead >= 0 &&
            playhead < n && (
              <line
                x1={playhead * cw}
                x2={playhead * cw}
                y1={0}
                y2={height + 10}
                stroke="#fff"
                strokeWidth="2"
              />
            )}
          {hover !== null && (
            <rect
              x={hover * cw}
              y={2}
              width={Math.max(cw, 2)}
              height={height + 4}
              fill="none"
              stroke="#fff"
              strokeWidth="1"
            />
          )}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <Tooltip x={hover * cw} y={height + 12} width={width}>
          {formatCell(hover)}
        </Tooltip>
      )}
    </div>
  );
}

// ---- heat grid (rows × columns) -----------------------------------------------------

export function HeatGrid({
  rows,
  cols,
  value,
  formatCell,
  label,
  cellHeight = 18,
  colLabelEvery = 1,
  colorFor,
}: {
  rows: string[];
  cols: string[];
  value: (r: number, c: number) => number | null;
  formatCell: (r: number, c: number) => ReactNode;
  label: string;
  cellHeight?: number;
  colLabelEvery?: number;
  /** Override the sequential colour (e.g. status colours for failed chunks). */
  colorFor?: (r: number, c: number, v: number | null, max: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<[number, number] | null>(null);
  const labelW = 64;
  const gap = 2;
  const cw = cols.length ? (width - labelW) / cols.length : 0;
  let max = 0;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      const v = value(r, c);
      if (v !== null && v > max) max = v;
    }
  }
  const h = rows.length * (cellHeight + gap) + 16;
  return (
    <div ref={ref} className="relative w-full" style={{ height: h }}>
      {width > 0 && (
        <svg
          width={width}
          height={h}
          role="img"
          aria-label={label}
          onMouseLeave={() => setHover(null)}
        >
          {rows.map((rl, r) => (
            <g key={rl}>
              <text
                x={labelW - 8}
                y={r * (cellHeight + gap) + cellHeight / 2}
                fill={AXIS_TEXT}
                fontSize="10"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {rl}
              </text>
              {cols.map((cl, c) => {
                const v = value(r, c);
                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: hover shows the tooltip only
                  <rect
                    key={cl}
                    x={labelW + c * cw}
                    y={r * (cellHeight + gap)}
                    width={Math.max(1, cw - (cw > 6 ? gap : 0.5))}
                    height={cellHeight}
                    rx={cw > 8 ? 3 : 0}
                    fill={
                      colorFor
                        ? colorFor(r, c, v, max)
                        : v === null
                          ? EMPTY_CELL
                          : rampColor(v, max)
                    }
                    stroke={
                      hover && hover[0] === r && hover[1] === c
                        ? "#fff"
                        : "none"
                    }
                    onMouseEnter={() => setHover([r, c])}
                  />
                );
              })}
            </g>
          ))}
          {cols.map((cl, c) =>
            c % colLabelEvery === 0 ? (
              <text
                key={`c-${cl}`}
                x={labelW + c * cw + cw / 2}
                y={h - 3}
                fill={AXIS_TEXT}
                fontSize="10"
                textAnchor="middle"
              >
                {cl}
              </text>
            ) : null,
          )}
        </svg>
      )}
      {hover && width > 0 && (
        <Tooltip
          x={labelW + hover[1] * cw}
          y={(hover[0] + 1) * (cellHeight + gap)}
          width={width}
        >
          {formatCell(hover[0], hover[1])}
        </Tooltip>
      )}
    </div>
  );
}

/** Horizontal bars with the value written beside each (single series, no legend). */
export function BarList({
  items,
  format = (v) => fmtNum(v),
  color = SERIES[0],
}: {
  items: { key: string; label: ReactNode; value: number; hint?: string }[];
  format?: (v: number) => string;
  color?: string;
}) {
  const max = Math.max(0, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.key} className="group" title={i.hint}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-zinc-300">{i.label}</span>
            <span className="tabular-nums text-zinc-400">
              {format(i.value)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${max ? (i.value / max) * 100 : 0}%`,
                background: color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
