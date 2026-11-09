"use client";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// ------------------------------------------------------------ Button (min 48px touch target)
const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99]",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:opacity-90",
        soft: "bg-soft text-softfg hover:brightness-95",
        outline: "border-2 border-inputline bg-transparent text-fg hover:bg-surface2",
        ghost: "text-fg hover:bg-surface2",
        danger: "bg-danger text-white hover:opacity-90",
        dangerOutline: "border-2 border-danger text-danger hover:bg-dangersoft",
      },
      size: { md: "min-h-12 px-5 text-base", lg: "min-h-14 px-7 text-lg", xl: "min-h-20 px-8 text-2xl w-full", sm: "min-h-11 px-4 text-sm" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...p }, ref) => (
  <button ref={ref} type={type} className={cn(button({ variant, size }), className)} {...p} />
));
Button.displayName = "Button";
export const buttonClass = (o?: VariantProps<typeof button>, extra?: string) => cn(button(o), extra);

// ------------------------------------------------------------ Layout bits
export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card bg-surface p-5 shadow-card border border-line/70", className)} {...p} />;
}
export function Badge({ tone = "soft", className, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: "soft" | "peach" | "lavender" | "warn" | "danger" }) {
  const t = { soft: "bg-soft text-softfg", peach: "bg-peach text-peachfg", lavender: "bg-lavender text-lavenderfg", warn: "bg-warnsoft text-warnfg", danger: "bg-dangersoft text-danger" }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold", t, className)} {...p} />;
}
export function Notice({ tone = "soft", title, children, className }: { tone?: "soft" | "warn" | "danger" | "peach"; title?: string; children: ReactNode; className?: string }) {
  const t = { soft: "bg-soft text-softfg", warn: "bg-warnsoft text-warnfg", danger: "bg-dangersoft text-danger", peach: "bg-peach text-peachfg" }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={cn("rounded-card p-4", t, className)}>
      {title && <p className="font-bold">{title}</p>}
      <div className="text-[0.95rem] leading-relaxed">{children}</div>
    </div>
  );
}
export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div><h1 className="text-3xl font-bold">{title}</h1>{sub && <p className="mt-1 text-muted">{sub}</p>}</div>
      {action}
    </header>
  );
}

// ------------------------------------------------------------ Form controls (always labelled)
const field = "w-full rounded-2xl border-2 border-inputline bg-surface px-4 min-h-12 text-base text-fg placeholder:text-muted";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(field, className)} {...p} />);
Input.displayName = "Input";
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn(field, "py-3", className)} rows={3} {...p} />);
Textarea.displayName = "Textarea";
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => <select ref={ref} className={cn(field, "pr-8", className)} {...p} />);
Select.displayName = "Select";

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block font-semibold">{label}</label>
      {hint && <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-sm text-muted">{hint}</p>}
      {children}
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}

/** A group of mutually-exclusive choices rendered as large radio "chips". Selection is conveyed by a tick AND a border, never colour alone. */
export function ChoiceGroup<T extends string | number>({ legend, value, onChange, options, columns = 1, hint, name }: {
  legend: string; value: T | undefined; onChange: (v: T) => void; options: { value: T; label: string; description?: string }[]; columns?: 1 | 2; hint?: string; name?: string;
}) {
  const id = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="font-semibold">{legend}</legend>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2")} role="radiogroup" aria-label={legend}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label key={String(o.value)} className={cn("flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border-2 px-4 py-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]", on ? "border-primary bg-soft" : "border-line bg-surface hover:bg-surface2")}>
              <input type="radio" className="sr-only" name={name ?? id} checked={on} onChange={() => onChange(o.value)} />
              <span aria-hidden className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary bg-primary text-primary-fg" : "border-inputline")}>{on && "✓"}</span>
              <span><span className="block font-semibold">{o.label}</span>{o.description && <span className="block text-sm text-muted">{o.description}</span>}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
export function CheckGroup<T extends string | number>({ legend, values, onToggle, options, hint, columns = 2 }: {
  legend: string; values: T[]; onToggle: (v: T) => void; options: { value: T; label: string; description?: string; icon?: ReactNode }[]; hint?: string; columns?: 1 | 2;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-semibold">{legend}</legend>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2")}>
        {options.map((o) => {
          const on = values.includes(o.value);
          return (
            <label key={String(o.value)} className={cn("flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border-2 px-4 py-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]", on ? "border-primary bg-soft" : "border-line bg-surface hover:bg-surface2")}>
              <input type="checkbox" className="sr-only" checked={on} onChange={() => onToggle(o.value)} />
              {o.icon && <span aria-hidden className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", on ? "bg-primary text-primary-fg" : "bg-soft text-softfg")}>{o.icon}</span>}
              <span aria-hidden className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2", on ? "border-primary bg-primary text-primary-fg" : "border-inputline")}>{on && "✓"}</span>
              <span><span className="block font-semibold">{o.label}</span>{o.description && <span className="block text-sm text-muted">{o.description}</span>}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div><label htmlFor={id} className="font-semibold">{label}</label>{description && <p id={`${id}-d`} className="text-sm text-muted">{description}</p>}</div>
      <button id={id} role="switch" aria-checked={checked} aria-describedby={description ? `${id}-d` : undefined} onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-8 w-14 shrink-0 rounded-full border-2 transition-colors", checked ? "border-primary bg-primary" : "border-inputline bg-surface2")}>
        <span className="sr-only">{checked ? "On" : "Off"}</span>
        <span aria-hidden className={cn("absolute top-0.5 flex size-6 items-center justify-center rounded-full bg-surface text-xs font-bold text-fg shadow transition-all", checked ? "left-[1.6rem]" : "left-0.5")}>{checked ? "✓" : ""}</span>
      </button>
    </div>
  );
}

export function ProgressBar({ value, max, label, tone = "primary" }: { value: number; max: number; label: string; tone?: "primary" | "accent" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-valuetext={`${value} of ${max}`} className="h-3 w-full overflow-hidden rounded-full bg-surface2 border border-line">
      <div className={cn("bar-fill h-full rounded-full", tone === "primary" ? "bg-primary" : "bg-accent")} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ------------------------------------------------------------ Dialog (native <dialog>: focus trap + Escape for free)
export function Dialog({ open, onClose, title, children, actions }: { open: boolean; onClose: () => void; title: string; children?: ReactNode; actions: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const tid = useId();
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal(); else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby={tid} onClose={onClose} onCancel={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-6 text-fg shadow-card">
      <h2 id={tid} className="text-xl font-bold">{title}</h2>
      <div className="mt-2 space-y-3 text-muted">{children}</div>
      <div className="mt-5 flex flex-wrap justify-end gap-3">{actions}</div>
    </dialog>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface2 p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </div>
  );
}
export function Spinner({ label = "Loading" }: { label?: string }) {
  return <div role="status" className="flex items-center justify-center gap-3 p-10 text-muted"><span aria-hidden className="size-5 animate-spin rounded-full border-2 border-inputline border-t-primary" />{label}…</div>;
}
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <Card className="text-center"><h2 className="text-xl font-bold">{title}</h2>{children && <p className="mt-2 text-muted">{children}</p>}{action && <div className="mt-4 flex justify-center">{action}</div>}</Card>;
}
