"use client";
import { BookHeart, CloudOff, Dumbbell, Home, LineChart, Settings as Cog, WifiOff, Check, RefreshCw, AlertTriangle, Smartphone } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store/provider";
import { Spinner } from "@/components/ui";

const NAV = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/workouts", label: "My Workouts", Icon: Dumbbell },
  { href: "/progress", label: "Progress", Icon: LineChart },
  { href: "/journey", label: "My Journey", Icon: BookHeart },
  { href: "/settings", label: "Settings", Icon: Cog },
];
const BARE = [/^\/workout(\/|$)/, /^\/onboarding/, /^\/auth/, /^\/privacy/, /^\/terms/, /^\/offline/, /^\/supporter/, /^\/admin/];
const NEEDS_PROFILE_EXEMPT = [/^\/onboarding/, /^\/auth/, /^\/privacy/, /^\/terms/, /^\/offline/, /^\/supporter/, /^\/admin/];

export function SyncBadge() {
  const { sync, online, mode } = useApp();
  let icon: ReactNode, text: string;
  switch (sync.kind) {
    case "local": icon = <Smartphone size={16} aria-hidden />; text = "Saved on this device"; break;
    case "synced": icon = <Check size={16} aria-hidden />; text = "All changes saved to your account"; break;
    case "syncing": icon = <RefreshCw size={16} aria-hidden className="animate-spin" />; text = "Saving…"; break;
    case "pending": icon = <RefreshCw size={16} aria-hidden />; text = `${sync.pending} change${sync.pending === 1 ? "" : "s"} waiting to save`; break;
    case "offline": icon = <WifiOff size={16} aria-hidden />; text = `Offline – ${sync.pending} change${sync.pending === 1 ? "" : "s"} saved on this device`; break;
    case "error": icon = <AlertTriangle size={16} aria-hidden />; text = sync.message; break;
    default: icon = <CloudOff size={16} aria-hidden />; text = "Signed out";
  }
  void online; void mode;
  return <p role="status" className="flex items-center gap-1.5 text-sm text-muted">{icon}<span>{text}</span></p>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { ready, data, mode, user, toasts, dismissToast } = useApp();
  const bare = BARE.some((r) => r.test(path));
  const needsOnboarding = ready && !data.profile && (mode === "local" || !!user) && !NEEDS_PROFILE_EXEMPT.some((r) => r.test(path));
  useEffect(() => { if (needsOnboarding) router.replace("/onboarding"); }, [needsOnboarding, router]);

  const content = !ready || needsOnboarding ? <Spinner label="Opening JoStrong" /> : children;
  const toastList = (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-fg shadow-card">
          <span>{t.text}</span><button className="min-h-11 rounded-full px-3 font-semibold underline" onClick={() => dismissToast(t.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  );
  if (bare) return <><main id="main" className="mx-auto w-full max-w-2xl px-4 py-6">{content}</main>{toastList}</>;

  return (
    <div className="md:flex">
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe md:static md:inset-auto md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:border-r md:border-t-0 md:p-5">
        <p className="mb-6 hidden md:block"><span className="text-2xl font-extrabold text-primary">JoStrong</span><span className="block text-sm text-muted">A little stronger, every day.</span></p>
        <ul className="mx-auto flex max-w-xl justify-around md:block md:space-y-1">
          {NAV.map(({ href, label, Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <li key={href} className="flex-1 md:flex-none">
                <Link href={href} aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs font-semibold md:min-h-12 md:flex-row md:justify-start md:gap-3 md:rounded-full md:px-4 md:text-base",
                    active ? "text-primary md:bg-soft" : "text-muted hover:text-fg")}>
                  <span className={cn("flex h-8 w-14 items-center justify-center rounded-full md:h-auto md:w-auto", active && "bg-soft md:bg-transparent")}><Icon size={22} aria-hidden /></span>
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-8 hidden md:block"><SyncBadge /></div>
      </nav>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-6 md:px-8 md:pb-10">
        <div className="mb-3 md:hidden"><SyncBadge /></div>
        {content}
      </main>
      {toastList}
    </div>
  );
}
