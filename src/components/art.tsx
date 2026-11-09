import type { ReactNode } from "react";
import { Armchair, Dumbbell, Footprints, Layers, Sofa, Spline, Square, Wrench } from "lucide-react";
import type { EquipmentKey, ExerciseCategory } from "@/lib/domain/types";

/** All artwork is original, decorative SVG (aria-hidden). It illustrates a movement family – it is NOT a demonstration video. */

export const CATEGORY_STYLE: Record<ExerciseCategory, { bg: string; fg: string; label: string }> = {
  lower_body: { bg: "var(--tile-sage)", fg: "var(--tile-sage-fg)", label: "Lower body" },
  upper_push: { bg: "var(--tile-peach)", fg: "var(--tile-peach-fg)", label: "Pushing" },
  upper_pull: { bg: "var(--tile-lav)", fg: "var(--tile-lav-fg)", label: "Pulling" },
  glutes_posterior: { bg: "var(--tile-sand)", fg: "var(--tile-sand-fg)", label: "Glutes" },
  core: { bg: "var(--tile-sage)", fg: "var(--tile-sage-fg)", label: "Core" },
  balance: { bg: "var(--tile-lav)", fg: "var(--tile-lav-fg)", label: "Balance" },
  mobility: { bg: "var(--tile-peach)", fg: "var(--tile-peach-fg)", label: "Mobility" },
};

const P = { fill: "none", stroke: "currentColor", strokeWidth: 5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
function Figure({ children }: { children: ReactNode }) {
  return <g {...P}>{children}</g>;
}
const FIGURES: Record<ExerciseCategory, ReactNode> = {
  lower_body: <Figure><circle cx="58" cy="26" r="9" fill="currentColor" stroke="none" /><path d="M58 38 L58 62 L42 70 L42 94 M58 62 L76 72 L76 94 M58 44 L76 52 M58 44 L40 52" /><path d="M30 98 H88" opacity=".5" /></Figure>,
  upper_push: <Figure><circle cx="26" cy="46" r="9" fill="currentColor" stroke="none" /><path d="M36 54 L88 62 L100 90 M36 54 L36 90 M88 62 L100 62" /><path d="M20 92 H108" opacity=".5" /></Figure>,
  upper_pull: <Figure><circle cx="52" cy="28" r="9" fill="currentColor" stroke="none" /><path d="M52 40 L66 64 L54 94 M66 64 L82 94 M52 44 L84 56 L96 44" /><path d="M96 38 v14" strokeWidth={9} /></Figure>,
  glutes_posterior: <Figure><circle cx="22" cy="78" r="9" fill="currentColor" stroke="none" /><path d="M32 82 L64 62 L86 62 L100 92 M64 62 L64 92 M32 84 H52" /><path d="M14 96 H108" opacity=".5" /></Figure>,
  core: <Figure><circle cx="24" cy="58" r="9" fill="currentColor" stroke="none" /><path d="M34 64 L100 76 M34 64 L34 92 M100 76 L106 92" /><path d="M16 94 H112" opacity=".5" /></Figure>,
  balance: <Figure><circle cx="60" cy="24" r="9" fill="currentColor" stroke="none" /><path d="M60 36 L60 66 L60 96 M60 66 L84 78 L84 62 M60 46 L36 38 M60 46 L84 38" /><path d="M44 100 H76" opacity=".5" /></Figure>,
  mobility: <Figure><circle cx="60" cy="30" r="9" fill="currentColor" stroke="none" /><path d="M60 42 L60 74 L48 98 M60 74 L72 98 M60 50 C40 42 34 30 40 18 M60 50 C80 42 86 30 80 18" /></Figure>,
};
export function CategoryArt({ category, size = 72, className = "" }: { category: ExerciseCategory; size?: number; className?: string }) {
  const s = CATEGORY_STYLE[category];
  return (
    <span aria-hidden className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-3xl ${className}`} style={{ width: size, height: size, background: s.bg, color: s.fg }}>
      <svg viewBox="0 0 120 120" width={size * 0.86} height={size * 0.86}>{FIGURES[category]}</svg>
    </span>
  );
}

const EQ: Record<EquipmentKey, typeof Dumbbell> = { none: Footprints, mat: Layers, chair: Armchair, bands: Spline, light_dumbbells: Dumbbell, adjustable_dumbbells: Dumbbell, bench: Sofa, step: Square, other: Wrench };
export function EquipIcon({ item, size = 22 }: { item: EquipmentKey; size?: number }) {
  const I = EQ[item];
  return <I size={size} aria-hidden />;
}

/** Circular progress. The value is also written as text, so colour/shape is never the only cue. */
export function Ring({ value, max, size = 120, stroke = 12, label, children }: { value: number; max: number; size?: number; stroke?: number; label: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-valuetext={`${value} of ${max}`} className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-fill)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="ring-anim" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Layered hills + sun + leaf. Decorative backdrop for hero cards. */
export function HeroArt({ className = "" }: { className?: string }) {
  // Occupies only a strip along the bottom edge so text always sits on the plain gradient (contrast-safe).
  return (
    <svg aria-hidden viewBox="0 0 400 100" preserveAspectRatio="xMidYMax slice" className={`pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full ${className}`}>
      <circle cx="72" cy="58" r="20" fill="var(--art-sun)" opacity=".95" /><circle cx="72" cy="58" r="32" fill="var(--art-sun)" opacity=".2" />
      <path d="M0 62 C70 36 130 62 200 46 C270 30 330 58 400 40 V100 H0Z" fill="var(--art-hill1)" opacity=".6" />
      <path d="M0 78 C80 56 150 82 230 66 C300 52 350 74 400 62 V100 H0Z" fill="var(--art-hill2)" opacity=".85" />
      <path d="M0 92 C90 80 170 96 250 86 C320 78 370 92 400 86 V100 H0Z" fill="var(--art-hill3)" />
      <g fill="var(--art-leaf)"><path d="M330 70 c-9-16-3-28 6-36 c7 14 5 25-6 36Z" /><path d="M352 74 c-7-12-2-21 5-27 c5 10 4 18-5 27Z" opacity=".7" /></g>
    </svg>
  );
}

export function RestArt({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 120 80" className={className}><path d="M84 12a28 28 0 1 0 14 52 24 24 0 0 1-14-52Z" fill="currentColor" opacity=".9" /><g fill="currentColor"><circle cx="30" cy="20" r="2.5" /><circle cx="48" cy="52" r="2" /><circle cx="18" cy="48" r="1.8" /><circle cx="64" cy="14" r="1.8" /></g></svg>
  );
}

export function Medal({ size = 56, className = "" }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 64 64" width={size} height={size} className={className}><path d="M20 4h10l4 18h-10zM44 4H34l-4 18h10z" fill="var(--tile-lav)" /><circle cx="32" cy="40" r="18" fill="var(--art-sun)" /><circle cx="32" cy="40" r="13" fill="none" stroke="var(--tile-peach-fg)" strokeWidth="2" opacity=".5" /><path d="m32 31 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="var(--tile-peach-fg)" opacity=".85" /></svg>
  );
}

/** Gentle confetti burst (CSS only; disabled automatically under reduced motion). */
export function Confetti() {
  const colors = ["var(--art-sun)", "var(--tile-lav)", "var(--tile-peach)", "var(--ring-fill)", "var(--tile-sage)"];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden">
      {Array.from({ length: 26 }, (_, i) => (
        <span key={i} className="confetti" style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 9) * 0.12}s`, transform: `rotate(${i * 31}deg)` }} />
      ))}
    </div>
  );
}

/** Seven dots for the week: done, planned, rest. State is shown by shape and text, not just colour. */
export function WeekDots({ days }: { days: { label: string; state: "done" | "planned" | "rest"; today: boolean; letter?: string }[] }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label="This week">
      {days.map((d) => (
        <li key={d.label} className="flex flex-col items-center gap-1 text-xs font-semibold">
          <span className="text-muted">{d.label}</span>
          <span className={`flex size-9 items-center justify-center rounded-full border-2 text-sm font-bold ${d.today ? "ring-2 ring-offset-2 ring-[var(--focus)] ring-offset-[var(--surface)]" : ""} ${d.state === "done" ? "border-transparent bg-[var(--ring-fill)] text-primary-fg" : d.state === "planned" ? "border-[var(--ring-fill)] text-fg" : "border-line text-muted"}`}>
            {d.state === "done" ? "✓" : d.state === "planned" ? d.letter : "·"}
          </span>
          <span className="sr-only">{d.state === "done" ? "completed" : d.state === "planned" ? `Workout ${d.letter} planned` : "rest day"}{d.today ? ", today" : ""}</span>
        </li>
      ))}
    </ol>
  );
}
