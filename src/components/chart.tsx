"use client";
import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface Series { key: string; label: string; color?: string; }
/** Accessible chart: a text summary for screen readers plus the same data as a table. Colour is never the only signal (labels, markers, table). */
export function AccessibleChart({ title, summary, data, xKey, series, kind, unit, empty }: {
  title: string; summary: string; data: Record<string, string | number | null>[]; xKey: string; series: Series[]; kind: "line" | "bar"; unit?: string; empty?: ReactNode;
}) {
  if (!data.length) return <figure><figcaption className="mb-2 font-bold">{title}</figcaption>{empty ?? <p className="text-muted">Nothing to show yet.</p>}</figure>;
  const axis = { stroke: "var(--muted)", fontSize: 12 } as const;
  return (
    <figure className="space-y-2">
      <figcaption className="font-bold">{title}</figcaption>
      <div role="img" aria-label={`${title}. ${summary}`} className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "bar" ? (
            <BarChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey={xKey} {...axis} /><YAxis allowDecimals={false} {...axis} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--fg)" }} />
              {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? "var(--ring-fill)"} radius={[10, 10, 0, 0]} />)}
            </BarChart>
          ) : (
            <AreaChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
              <defs>{series.map((s, i) => <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color ?? "var(--ring-fill)"} stopOpacity={i ? 0.12 : 0.35} /><stop offset="100%" stopColor={s.color ?? "var(--ring-fill)"} stopOpacity={0} /></linearGradient>)}</defs>
              <CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey={xKey} {...axis} /><YAxis {...axis} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--fg)" }} />
              {series.map((s, i) => <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? "var(--ring-fill)"} fill={`url(#g-${s.key})`} strokeWidth={3} strokeDasharray={i ? "6 4" : undefined} dot={{ r: 4, fill: "var(--surface)", strokeWidth: 2 }} connectNulls />)}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
      <details className="text-sm"><summary className="min-h-11 cursor-pointer font-semibold">View as a table</summary>
        <div className="overflow-x-auto"><table className="mt-2 w-full text-left"><thead><tr><th className="py-1 pr-3">{xKey === "label" ? "When" : xKey}</th>{series.map((s) => <th key={s.key} className="py-1 pr-3">{s.label}{unit ? ` (${unit})` : ""}</th>)}</tr></thead>
          <tbody>{data.map((r) => <tr key={String(r[xKey])} className="border-t border-line"><td className="py-1 pr-3">{r[xKey]}</td>{series.map((s) => <td key={s.key} className="py-1 pr-3">{r[s.key] ?? "–"}</td>)}</tr>)}</tbody></table></div>
      </details>
    </figure>
  );
}
