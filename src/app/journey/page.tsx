"use client";
import { BookHeart, Camera, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatDateAU, uuid } from "@/lib/domain/dates";
import { MILESTONE_DEFS } from "@/lib/domain/stats";
import { exerciseName, finishedSessions } from "@/lib/store/selectors";
import { deleteJournal, saveJournal } from "@/lib/store/actions";
import { useApp } from "@/lib/store/provider";
import { getSupabase } from "@/lib/supabase/client";
import type { JournalEntry } from "@/lib/domain/types";
import { Badge, Button, Card, ChoiceGroup, CheckGroup, Dialog, EmptyState, Field, Notice, PageHeader, Switch, Textarea } from "@/components/ui";

const rate = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }));

async function resizeToJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.82));
}
function Photo({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { getSupabase()?.storage.from("journal-photos").createSignedUrl(path, 3600).then((r) => setUrl(r.data?.signedUrl ?? null)); }, [path]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="Your progress photo" className="max-h-64 rounded-2xl" /> : <p className="text-sm text-muted">Loading photo…</p>;
}

export default function JourneyPage() {
  const { data, run, toast, user, mode } = useApp();
  const [editing, setEditing] = useState<Partial<JournalEntry> & { _id: string } | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const performed = useMemo(() => [...new Set(data.sets.map((s) => s.exerciseId))], [data.sets]);

  const timeline = useMemo(() => {
    const items: { key: string; date: string; kind: "journal" | "milestone" | "session"; j?: JournalEntry; text?: string; sub?: string }[] = [];
    for (const j of data.journal) items.push({ key: j.id, date: j.date, kind: "journal", j });
    for (const m of data.milestones) items.push({ key: m.id, date: m.achievedAt.slice(0, 10), kind: "milestone", text: MILESTONE_DEFS[m.key]?.title ?? m.key, sub: MILESTONE_DEFS[m.key]?.message });
    for (const s of finishedSessions(data)) items.push({ key: s.id, date: s.date, kind: "session", text: `Completed Workout ${s.letter}${s.status === "ended_early" ? " (finished early)" : ""}` });
    return items.sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind));
  }, [data]);

  const canPhoto = data.preferences.photosEnabled && mode === "cloud" && !!user;
  const start = () => setEditing({ _id: uuid(), date: undefined, enjoyed: [], disliked: [] });
  const save = async (file?: File) => {
    if (!editing) return;
    setBusy(true);
    let photoPath = editing.photoPath;
    try {
      if (file && canPhoto) {
        const blob = await resizeToJpeg(file);
        photoPath = `${user!.id}/${editing._id}.jpg`;
        const { error } = await getSupabase()!.storage.from("journal-photos").upload(photoPath, blob, { upsert: true, contentType: "image/jpeg" });
        if (error) { toast("The photo couldn't be uploaded, so the entry was saved without it."); photoPath = editing.photoPath; }
      }
      run((d, c) => saveJournal(d, c, { ...editing, id: editing.id ?? editing._id, photoPath }));
      toast("Saved to your journey."); setEditing(null);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="My Journey" sub="Your private training diary. Nothing here is shared unless you choose." action={<Button onClick={start}><BookHeart size={18} aria-hidden /> New entry</Button>} />
      {timeline.length === 0 ? <EmptyState title="Your story starts here" action={<Button onClick={start}>Write your first entry</Button>}>Jot down how you felt, what you enjoyed, or something you&apos;re proud of. It&apos;s just for you.</EmptyState> : (
        <ol className="space-y-3">
          {timeline.map((t) => (
            <li key={t.key}>
              {t.kind === "journal" && t.j ? (
                <Card className="space-y-2"><div className="flex items-center justify-between gap-2"><p className="font-bold">{formatDateAU(t.date, "weekday")}</p><div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ ...t.j!, _id: t.j!.id })}>Edit</Button>
                  <Button variant="ghost" size="sm" aria-label="Delete entry" onClick={() => setDel(t.j!.id)}><Trash2 size={18} aria-hidden /></Button></div></div>
                  {t.j.feeling && <p>{t.j.feeling}</p>}
                  {t.j.achievement && <p><strong>Proud of: </strong>{t.j.achievement}</p>}
                  {t.j.enjoyed.length > 0 && <p><strong>Enjoyed: </strong>{t.j.enjoyed.join(", ")}</p>}
                  {t.j.disliked.length > 0 && <p><strong>Not for me: </strong>{t.j.disliked.join(", ")}</p>}
                  {t.j.goal && <p><strong>Goal: </strong>{t.j.goal}</p>}
                  {t.j.mobilityNote && <p><strong>Mobility: </strong>{t.j.mobilityNote}</p>}
                  <div className="flex flex-wrap gap-2 text-sm">{t.j.energy && <Badge>Energy {t.j.energy}/5</Badge>}{t.j.confidence && <Badge>Confidence {t.j.confidence}/5</Badge>}{t.j.sharedWithSupporter && <Badge tone="lavender">Shared with your supporter</Badge>}</div>
                  {t.j.photoPath && <Photo path={t.j.photoPath} />}</Card>
              ) : t.kind === "milestone" ? (
                <Card className="bg-peach text-peachfg"><p className="font-bold">🌟 {t.text}</p><p>{t.sub}</p><p className="text-sm">{formatDateAU(t.date)}</p></Card>
              ) : <div className="flex items-center gap-3 px-2 text-muted"><span aria-hidden className="size-3 rounded-full bg-accent" /><p>{formatDateAU(t.date, "weekday")} · {t.text}</p></div>}
            </li>
          ))}
        </ol>
      )}

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit entry" : "New journal entry"}
        actions={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={busy} onClick={() => { const f = (document.getElementById("photo") as HTMLInputElement | null)?.files?.[0]; void save(f); }}>Save entry</Button></>}>
        {editing && (
          <div className="max-h-[60dvh] space-y-4 overflow-y-auto pr-1 text-fg">
            <Field label="How did you feel?" htmlFor="jf"><Textarea id="jf" value={editing.feeling ?? ""} maxLength={2000} onChange={(e) => setEditing({ ...editing, feeling: e.target.value })} /></Field>
            <Field label="Something you're proud of" htmlFor="ja"><Textarea id="ja" rows={2} value={editing.achievement ?? ""} maxLength={1000} onChange={(e) => setEditing({ ...editing, achievement: e.target.value })} /></Field>
            {performed.length > 0 && <>
              <CheckGroup legend="Exercises you enjoyed" values={editing.enjoyed ?? []} onToggle={(v) => setEditing({ ...editing, enjoyed: (editing.enjoyed ?? []).includes(v) ? (editing.enjoyed ?? []).filter((x) => x !== v) : [...(editing.enjoyed ?? []), v] })} options={performed.map((id) => ({ value: exerciseName(id), label: exerciseName(id) }))} />
              <CheckGroup legend="Exercises that weren't for you" values={editing.disliked ?? []} onToggle={(v) => setEditing({ ...editing, disliked: (editing.disliked ?? []).includes(v) ? (editing.disliked ?? []).filter((x) => x !== v) : [...(editing.disliked ?? []), v] })} options={performed.map((id) => ({ value: exerciseName(id), label: exerciseName(id) }))} />
            </>}
            <ChoiceGroup legend="Energy (1 – 5)" value={editing.energy} onChange={(v) => setEditing({ ...editing, energy: v as 1 })} options={rate} />
            <ChoiceGroup legend="Confidence (1 – 5)" value={editing.confidence} onChange={(v) => setEditing({ ...editing, confidence: v as 1 })} options={rate} />
            <Field label="A goal for the weeks ahead" htmlFor="jg"><Textarea id="jg" rows={2} value={editing.goal ?? ""} maxLength={500} onChange={(e) => setEditing({ ...editing, goal: e.target.value })} /></Field>
            <Field label="Mobility improvements you've noticed (optional)" htmlFor="jm"><Textarea id="jm" rows={2} value={editing.mobilityNote ?? ""} maxLength={500} onChange={(e) => setEditing({ ...editing, mobilityNote: e.target.value })} /></Field>
            {mode === "cloud" && <Switch label="Share this entry with my supporter" description="Only if you have a supporter who is allowed to see journal notes." checked={!!editing.sharedWithSupporter} onChange={(v) => setEditing({ ...editing, sharedWithSupporter: v })} />}
            {canPhoto ? <Field label="Progress photo (optional, private)" htmlFor="photo" hint="Stored privately in your account. Never shared automatically."><input id="photo" type="file" accept="image/*" className="block min-h-12 w-full" /></Field>
              : <Notice><Camera size={16} aria-hidden className="mr-1 inline" /> Progress photos are switched off. You can turn them on in Settings – they&apos;re never required.{mode === "local" ? " Photos need an account so they can be stored privately." : ""}</Notice>}
          </div>
        )}
      </Dialog>
      <Dialog open={!!del} onClose={() => setDel(null)} title="Delete this entry?" actions={<><Button variant="outline" onClick={() => setDel(null)}>Keep it</Button><Button variant="danger" onClick={() => { run((d, c) => deleteJournal(d, c, del!)); setDel(null); toast("Entry deleted."); }}>Delete entry</Button></>}>
        <p>This permanently deletes your journal entry. It can&apos;t be undone.</p></Dialog>
    </div>
  );
}
