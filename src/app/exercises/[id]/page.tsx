import { EXERCISES } from "@/lib/domain/exercises";
import { ExerciseDetail } from "./detail";

export function generateStaticParams() { return EXERCISES.map((e) => ({ id: e.id })); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExerciseDetail id={id} />;
}
