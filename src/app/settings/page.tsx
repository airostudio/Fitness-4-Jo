"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store/provider";
import { getSupabase } from "@/lib/supabase/client";
import { PageHeader, Notice, buttonClass } from "@/components/ui";
import { AppearanceCard, EquipmentCard, GoalsCard, HealthCard, ProfileCard, TrainingCard } from "@/components/settings/prefs";
import { RemindersCard } from "@/components/settings/reminders";
import { SupporterCard } from "@/components/settings/supporter";
import { NutritionSettings } from "@/components/settings/nutrition";
import { DataCard } from "@/components/settings/data-account";

export default function SettingsPage() {
  const { data, mode } = useApp();
  const [admin, setAdmin] = useState(false);
  useEffect(() => { getSupabase()?.from("app_admins").select("user_id").maybeSingle().then((r) => setAdmin(!!r.data)); }, []);
  if (!data.profile) return null;
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" sub="Make JoStrong yours." />
      <nav aria-label="Settings sections" className="flex flex-wrap gap-2 text-sm font-semibold">
        {[["profile", "About you"], ["training", "Training"], ["equipment", "Equipment"], ["health", "Health"], ["goals", "Goals"], ["appearance", "Appearance"], ["reminders", "Reminders"], ["supporter", "Supporter"], ["nutrition", "Nutrition"], ["data", "Your data"]].map(([id, l]) => <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-full bg-surface2 px-4">{l}</a>)}
      </nav>
      <ProfileCard /><TrainingCard /><EquipmentCard /><HealthCard /><GoalsCard /><AppearanceCard /><RemindersCard /><SupporterCard /><NutritionSettings /><DataCard />
      {admin && <Link href="/admin" className={buttonClass({ variant: "outline", size: "lg" }, "w-full")}>Administration</Link>}
      <Notice title="About the coach">An optional AI coach is planned for the future and is switched off. Your plan and progression always come from fixed, explainable rules – never an AI.</Notice>
      <p className="pb-6 text-center text-sm text-muted">JoStrong 1.0 · {mode === "cloud" ? "Account sync on" : "This device only"}</p>
    </div>
  );
}
