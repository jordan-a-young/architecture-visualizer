import { useState } from 'react';
import type { RelationshipLegendEntry } from './edgeStyles.js';

export interface LegendHighlight {
  hovered: string | null;
  focused: string | null;
  pinned: string | null;
}
export const emptyLegendHighlight: LegendHighlight = {
  hovered: null,
  focused: null,
  pinned: null,
};
export function activeLegendEntry(
  entries: readonly RelationshipLegendEntry[],
  highlight: LegendHighlight,
) {
  for (const id of [highlight.hovered, highlight.focused, highlight.pinned]) {
    const entry = entries.find((entry) => entry.id === id);
    if (entry) return entry;
  }
}

/** Ordinary DOM controls also remain useful in the WebGL inspector fallback. */
export function RelationshipLegend({
  entries,
  highlight,
  onChange,
}: {
  entries: readonly RelationshipLegendEntry[];
  highlight: LegendHighlight;
  onChange: (next: LegendHighlight) => void;
}) {
  const [open, setOpen] = useState(true);
  const active = activeLegendEntry(entries, highlight);
  if (!entries.length) return null;
  return (
    <details
      className="av-relationship-legend"
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
        if (!event.currentTarget.open) onChange(emptyLegendHighlight);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && active) {
          event.stopPropagation();
          onChange(emptyLegendHighlight);
        }
      }}
    >
      <summary>Relationship legend</summary>
      <p>Hover or focus to highlight · Click to pin · Esc to clear</p>
      <ul aria-label="Relationship styles">
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              aria-pressed={highlight.pinned === entry.id}
              data-active={active?.id === entry.id || undefined}
              title={`${entry.description ? entry.description + ' · ' : ''}${entry.style.lineStyle} · ${entry.style.color} · width ${entry.style.width}`}
              aria-label={`${entry.label}, ${entry.style.lineStyle}, ${entry.edgeKeys.length} relationship${entry.edgeKeys.length === 1 ? '' : 's'}, color ${entry.style.color}, width ${entry.style.width}`}
              onPointerEnter={(event) => {
                if (event.pointerType !== 'touch')
                  onChange({ ...highlight, hovered: entry.id });
              }}
              onPointerLeave={() => onChange({ ...highlight, hovered: null })}
              onFocus={() => onChange({ ...highlight, focused: entry.id })}
              onBlur={() => onChange({ ...highlight, focused: null })}
              onClick={() =>
                onChange({
                  ...emptyLegendHighlight,
                  pinned: highlight.pinned === entry.id ? null : entry.id,
                })
              }
            >
              <svg
                width="48"
                height="14"
                viewBox="0 0 48 14"
                aria-hidden="true"
                focusable="false"
                style={{ color: entry.style.color }}
              >
                <line
                  x1="2"
                  y1="7"
                  x2="39"
                  y2="7"
                  stroke="currentColor"
                  strokeWidth={
                    entry.style.lineStyle === 'dotted'
                      ? Math.max(2, entry.style.width)
                      : entry.style.width
                  }
                  strokeDasharray={
                    entry.style.lineStyle === 'dashed'
                      ? '6 4'
                      : entry.style.lineStyle === 'dotted'
                        ? '0 5'
                        : undefined
                  }
                  strokeLinecap={
                    entry.style.lineStyle === 'dotted' ? 'round' : 'butt'
                  }
                />
                <path d="M39 3 L46 7 L39 11 Z" fill="currentColor" />
              </svg>
              <span>
                {entry.label}
                <small>
                  {entry.style.lineStyle} · {entry.edgeKeys.length}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
