import type { ReadinessMode } from "./types";

export interface ReadinessAnswers {
  energy: "great" | "good" | "tired" | "very_tired";
  muscles: "recovered" | "mild" | "quite_sore";
  pain: "none" | "familiar" | "new";
}
export interface ReadinessAdvice {
  recommended: ReadinessMode;
  headline: string;
  detail: string;
  options: { mode: ReadinessMode; label: string; description: string }[];
  seekGuidance: boolean;
  swapSuggestion: boolean;
}

const OPT = {
  normal: { mode: "normal" as const, label: "Normal session", description: "Train as planned." },
  lighter: { mode: "lighter" as const, label: "Lighter session", description: "Same exercises with fewer sets and a little more rest." },
  recovery: { mode: "recovery" as const, label: "Take a recovery day", description: "Rest today. We'll find another day for this session." },
};

/** Deterministic readiness rules. Never encourages training through new or significant pain. */
export function assessReadiness(a: ReadinessAnswers): ReadinessAdvice {
  if (a.pain === "new") {
    return {
      recommended: "seek_guidance", seekGuidance: true, swapSuggestion: false,
      headline: "Let's rest today",
      detail: "New or significant pain is a signal to pause. Please skip today's session and consider speaking with a doctor or physiotherapist if it continues or worries you. Nothing is lost – your plan will wait for you.",
      options: [OPT.recovery],
    };
  }
  const veryTired = a.energy === "very_tired";
  const sore = a.muscles === "quite_sore";
  if (veryTired || sore) {
    return {
      recommended: "recovery", seekGuidance: false, swapSuggestion: a.pain === "familiar",
      headline: "Your body may want a rest day",
      detail: "Rest is part of getting stronger. A recovery day is a great choice – or you can do a lighter session if you feel like moving gently.",
      options: [OPT.recovery, OPT.lighter],
    };
  }
  if (a.energy === "tired" || a.muscles === "mild" || a.pain === "familiar") {
    return {
      recommended: "lighter", seekGuidance: false, swapSuggestion: a.pain === "familiar",
      headline: "A lighter session could suit today",
      detail: a.pain === "familiar"
        ? "You noted some familiar discomfort. A lighter session with comfortable alternatives is a gentle option. Stop any exercise that makes it worse."
        : "A lighter session keeps the habit going while respecting how you feel. You can still choose a normal session.",
      options: [OPT.lighter, OPT.normal, OPT.recovery],
    };
  }
  return {
    recommended: "normal", seekGuidance: false, swapSuggestion: false,
    headline: "You're ready to go",
    detail: "Everything looks good. Listen to your body as you go – you can always make it lighter.",
    options: [OPT.normal, OPT.lighter, OPT.recovery],
  };
}

/** Sets used for a lighter session: one fewer, never below one. */
export function lighterSets(sets: number): number { return Math.max(1, sets - 1); }
