import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <article className="space-y-4 leading-relaxed">
      <p className="rounded-2xl bg-warnsoft p-3 text-warnfg"><strong>Draft for legal review.</strong> This is a plain-language starting point and not legal advice. Have it reviewed (including against the Australian Privacy Principles) before wider use.</p>
      <h1 className="text-3xl font-bold">Privacy policy</h1>
      <p>JoStrong is a private strength-training companion. We collect only what is needed to run it for you.</p>
      <h2 className="text-xl font-bold">What we store</h2>
      <ul className="list-disc space-y-1 pl-6"><li>Your name and, only if you choose to give them, date of birth, height and weight.</li><li>Your training preferences, equipment and the optional comfort/health answers you give.</li><li>Your workouts, sets, check-ins, progression decisions, milestones and journal entries.</li><li>Optional progress photographs (off by default).</li><li>Your email address and sign-in details (managed by Supabase Auth).</li></ul>
      <h2 className="text-xl font-bold">Where it lives</h2>
      <p>On your device (in your browser&apos;s storage) so JoStrong works offline, and – if you have an account – in a private database (Supabase) protected by row-level security so only you can read your records. If accounts are not enabled, your data never leaves your device.</p>
      <h2 className="text-xl font-bold">Who can see it</h2>
      <p>Only you. A supporter sees only what you explicitly allow and can be removed instantly. Administrators can maintain exercises but cannot read your health details, journal or workouts. We do not sell or share your data and do not use it for advertising. There are no third-party analytics or trackers.</p>
      <h2 className="text-xl font-bold">Your choices</h2>
      <p>You can download all your data or permanently delete your account and everything in it from <Link className="font-semibold underline" href="/settings#data">Settings</Link>. Deleting removes your database records and photographs. Signing out clears the data held on that device.</p>
      <h2 className="text-xl font-bold">Health information</h2>
      <p>Health answers are optional and used only to choose gentler exercises. JoStrong does not diagnose or treat any condition. Our logs never include health or journal content.</p>
      <h2 className="text-xl font-bold">Notifications</h2>
      <p>Reminders are optional. We only ask permission when you press the button, and send at most one gentle reminder per session.</p>
      <h2 className="text-xl font-bold">Contact</h2>
      <p>[Add your contact details and the name of the responsible person or organisation here.]</p>
    </article>
  );
}
