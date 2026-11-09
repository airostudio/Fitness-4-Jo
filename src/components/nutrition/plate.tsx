import { GROUPS, type FoodGroup } from "@/lib/domain/nutrition";

/** "Balanced plate" illustration: ½ vegetables, ¼ protein, ¼ wholegrains, plus fruit and dairy on the side. Decorative; the legend below is the accessible content. */
export function Plate() {
  const c = 100, r = 78;
  const pt = (deg: number) => [c + r * Math.cos((deg * Math.PI) / 180), c + r * Math.sin((deg * Math.PI) / 180)] as const;
  const wedge = (a0: number, a1: number) => { const [x0, y0] = pt(a0), [x1, y1] = pt(a1); return `M${c} ${c} L${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}Z`; };
  return (
    <figure className="space-y-3">
      <svg aria-hidden viewBox="0 0 280 200" className="mx-auto w-full max-w-sm">
        <circle cx={c} cy={c} r={r + 14} fill="var(--surface)" stroke="var(--border)" strokeWidth="3" />
        <path d={wedge(90, 270)} fill="var(--tile-sage)" /><path d={wedge(270, 360)} fill="var(--tile-lav)" /><path d={wedge(0, 90)} fill="var(--tile-sand)" />
        <g stroke="var(--tile-sage-fg)" strokeWidth="3" fill="none" strokeLinecap="round"><path d="M52 80c10-14 22-10 22 4M60 120c14-6 22 4 16 14M80 150c8-10 18-6 16 6" /></g>
        <circle cx="140" cy="68" r="9" fill="var(--tile-lav-fg)" opacity=".7" /><circle cx="160" cy="84" r="7" fill="var(--tile-lav-fg)" opacity=".5" />
        <g fill="var(--tile-sand-fg)" opacity=".7"><circle cx="146" cy="128" r="4" /><circle cx="158" cy="140" r="4" /><circle cx="136" cy="144" r="4" /><circle cx="162" cy="122" r="4" /></g>
        <circle cx="236" cy="52" r="20" fill="var(--tile-peach)" stroke="var(--tile-peach-fg)" strokeWidth="3" /><path d="M236 32c2-8 8-10 12-8" stroke="var(--tile-sage-fg)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M222 112h28l-4 44a6 6 0 0 1-6 5h-8a6 6 0 0 1-6-5z" fill="var(--surface)" stroke="var(--tile-lav-fg)" strokeWidth="3" /><path d="M224 128h24l-2 24h-20z" fill="var(--tile-lav)" />
      </svg>
      <figcaption>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          <li><strong>Half the plate:</strong> vegetables and salad</li><li><strong>A quarter:</strong> protein food</li>
          <li><strong>A quarter:</strong> wholegrain carbohydrate</li><li><strong>On the side:</strong> fruit, and dairy or an alternative</li>
        </ul>
      </figcaption>
    </figure>
  );
}
export const GROUP_ICON: Record<FoodGroup, string> = { veg: "🥦", fruit: "🍎", grains: "🌾", protein: "🍳", dairy: "🥛" };
export const GROUP_LABEL = Object.fromEntries(GROUPS.map((g) => [g.key, g.label])) as Record<FoodGroup, string>;
