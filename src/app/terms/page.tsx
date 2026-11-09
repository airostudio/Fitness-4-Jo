import type { Metadata } from "next";
export const metadata: Metadata = { title: "Terms of use" };

export default function Terms() {
  return (
    <article className="space-y-4 leading-relaxed">
      <p className="rounded-2xl bg-warnsoft p-3 text-warnfg"><strong>Draft for legal review.</strong> Not legal advice. Have this reviewed before relying on it.</p>
      <h1 className="text-3xl font-bold">Terms of use</h1>
      <h2 className="text-xl font-bold">Not medical advice</h2>
      <p>JoStrong provides general strength-training guidance. It is not medical advice and does not diagnose, treat or prevent any condition. Speak with a doctor or physiotherapist before starting an exercise programme, especially if you have a health condition, injury or professional restrictions.</p>
      <h2 className="text-xl font-bold">Listen to your body</h2>
      <p>Stop any exercise that causes sharp, pinching or unusual pain, and seek advice if it continues. You are responsible for choosing weights and movements that are safe for you. Suggestions from JoStrong are optional and based on fixed rules and the information you log.</p>
      <h2 className="text-xl font-bold">Your account</h2>
      <p>Keep your sign-in details private. You can delete your account and data at any time in Settings.</p>
      <h2 className="text-xl font-bold">Availability</h2>
      <p>JoStrong is provided as-is without a guarantee of uninterrupted service. Export your data if you want a personal backup.</p>
      <h2 className="text-xl font-bold">Results</h2>
      <p>Individual results vary. JoStrong makes no promise of any specific amount of strength or muscle gain in any period of time.</p>
      <p>[Add governing law, operator details and any additional terms here.]</p>
    </article>
  );
}
