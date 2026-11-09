import Link from "next/link";
export const metadata = { title: "Offline" };
export default function Offline() {
  return (
    <div className="space-y-4 text-center"><h1 className="text-3xl font-bold">You&apos;re offline</h1>
      <p className="text-muted">That page isn&apos;t saved on this device yet. Your workouts still work, and anything you log is kept safe and saved to your account when you&apos;re back online.</p>
      <Link href="/workout" className="inline-flex min-h-14 items-center justify-center rounded-full bg-primary px-7 text-lg font-semibold text-primary-fg">Go to my workout</Link></div>
  );
}
