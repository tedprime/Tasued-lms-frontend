import { forwardRef, type MouseEvent as ReactMouseEvent, useId, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, Inbox, AlertTriangle, Search } from "lucide-react";
import { cn } from "../lib/cn";

/* ───────────── Button (from SLAN's Button, extended) ───────────── */

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "inverted" | "subtle";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const btnVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary-500 text-white hover:bg-primary-dark shadow-sm hover:shadow-cta",
  secondary: "bg-secondary-500 text-tertiary-500 hover:bg-secondary-dark font-bold",
  outline: "border border-neutral-300 text-tertiary-500 bg-white hover:border-primary-500 hover:text-primary-500",
  ghost: "text-primary-500 hover:bg-primary-50 bg-transparent",
  danger: "bg-danger text-white hover:brightness-90",
  inverted: "bg-tertiary-500 text-white hover:bg-tertiary-light",
  subtle: "bg-neutral-100 text-tertiary-500 hover:bg-neutral-200",
};

const btnSizes: Record<ButtonSize, string> = {
  xs: "text-xs px-2.5 py-1.5 rounded-md gap-1.5",
  sm: "text-xs px-3.5 py-2 rounded-md gap-1.5",
  md: "text-sm px-4.5 py-2.5 rounded-lg gap-2",
  lg: "text-sm px-6 py-3.5 rounded-lg gap-2",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center font-semibold transition-all duration-200 select-none whitespace-nowrap",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:pointer-events-none",
    btnVariants[variant],
    btnSizes[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonClasses(variant, size, className)} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-tertiary-500 transition-colors disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ───────────── Card ───────────── */

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 max-w-full rounded-xl border border-neutral-200 bg-white shadow-card", className)} {...rest} />;
}

export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-bold text-tertiary-500">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...rest} />;
}

/* ───────────── Badge ───────────── */

export type Tone = "neutral" | "green" | "gold" | "red" | "blue" | "amber" | "purple" | "navy";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-neutral-100 text-neutral-700 border-neutral-200",
  green: "bg-success-50 text-success-700 border-success-200",
  gold: "bg-secondary-50 text-secondary-700 border-secondary-200",
  red: "bg-danger-50 text-danger border-red-200",
  blue: "bg-info-50 text-info border-blue-200",
  amber: "bg-warning-50 text-warning border-amber-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  navy: "bg-tertiary-50 text-tertiary-500 border-tertiary-100",
};

export function Badge({ tone = "neutral", className, children, dot }: { tone?: Tone; className?: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap", toneClasses[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/* ───────────── Form fields ───────────── */

const fieldBase =
  "w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-tertiary-500 placeholder:text-neutral-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-3 focus:ring-primary-50 disabled:bg-neutral-100 disabled:text-neutral-500";

export function Field({ label, hint, error, required, children, className, htmlFor }: { label?: ReactNode; hint?: ReactNode; error?: ReactNode; required?: boolean; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-tertiary-500">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldBase, invalid && "border-danger focus:ring-danger-50", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, rows = 4, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(fieldBase, "resize-y", invalid && "border-danger", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select({ className, invalid, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23888%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_0.8rem_center] bg-no-repeat pr-9", invalid && "border-danger", className)} {...rest}>
      {children}
    </select>
  );
});

export function Checkbox({ label, description, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={rest.id ?? id} className={cn("flex cursor-pointer items-start gap-3", className)}>
      <input id={rest.id ?? id} type="checkbox" className="mt-0.5 size-4 shrink-0 rounded border-neutral-300 accent-primary-500" {...rest} />
      <span>
        <span className="block text-sm font-medium text-tertiary-500">{label}</span>
        {description && <span className="block text-xs text-neutral-500">{description}</span>}
      </span>
    </label>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cn("flex items-center justify-between gap-4", disabled ? "opacity-60" : "cursor-pointer")}>
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-semibold text-tertiary-500">{label}</span>}
          {description && <span className="block text-xs text-neutral-500">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-primary-500" : "bg-neutral-300")}
      >
        <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
      </button>
    </label>
  );
}

export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" aria-hidden />
      <input type="search" className={cn(fieldBase, "pl-9")} {...rest} />
    </div>
  );
}

/* ───────────── Feedback states ───────────── */

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-primary-500", className)} aria-label={label} />;
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-neutral-500">
      <Spinner className="size-7" />
      {label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-neutral-200/70", className)} />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-500">{icon ?? <Inbox className="size-6" />}</div>
      <p className="font-headline text-base font-bold text-tertiary-500">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Couldn't load this", description, onRetry }: { title?: ReactNode; description?: ReactNode; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<AlertTriangle className="size-6 text-danger" />}
      title={title}
      description={description ?? "Check your connection and try again."}
      action={onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
    />
  );
}

export function Alert({ tone = "blue", title, children, className, icon }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <div role="status" className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", toneClasses[tone], className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div>}
      </div>
    </div>
  );
}

/* ───────────── Progress (from SLAN's Progress) ───────────── */

export function Progress({ value, className, tone = "green", label }: { value: number; className?: string; tone?: "green" | "gold" | "red"; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const bar = tone === "gold" ? "bg-secondary-500" : tone === "red" ? "bg-danger" : "bg-success";
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-neutral-200", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", bar)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function ProgressRing({ value, size = 56, stroke = 6, label }: { value: number; size?: number; stroke?: number; label?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-neutral-200)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-success)" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <span className="absolute text-xs font-bold text-tertiary-500">{label ?? `${Math.round(v)}%`}</span>
    </div>
  );
}

/* ───────────── Avatar ───────────── */

export function Avatar({ name, src, size = 36, className }: { name: string; src?: string; size?: number; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  return src ? (
    <img src={src} alt="" width={size} height={size} className={cn("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-primary-50 font-bold text-primary-600", className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {initials}
    </span>
  );
}

/* ───────────── Layout helpers ───────────── */

export function PageHeader({ title, description, actions, breadcrumb, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumb?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {breadcrumb && <div className="mb-2 text-xs text-neutral-500">{breadcrumb}</div>}
        <h1 className="font-headline text-2xl font-extrabold text-tertiary-500 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-neutral-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, tone = "green", className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "green" | "gold" | "navy" | "red"; className?: string }) {
  const iconBg = { green: "bg-primary-50 text-primary-500", gold: "bg-secondary-50 text-secondary-700", navy: "bg-tertiary-50 text-tertiary-500", red: "bg-danger-50 text-danger" }[tone];
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-neutral-500">{label}</p>
          <p className="mt-1 font-headline text-2xl font-extrabold text-tertiary-500">{value}</p>
          {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
        </div>
        {icon && <span className={cn("flex size-10 items-center justify-center rounded-lg", iconBg)}>{icon}</span>}
      </div>
    </Card>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-neutral-200", className)} />;
}

export function KeyValue({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((it, i) => (
        <div key={i}>
          <dt className="text-xs font-medium text-neutral-500">{it.label}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-tertiary-500">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Renders trusted, server-sanitised rich text (course text, instructions, posts).
 * `deferImages` (low-data mode): images aren't downloaded until the reader taps them.
 */
export function RichContent({ html, className, deferImages }: { html: string; className?: string; deferImages?: boolean }) {
  const shown = deferImages ? html.replace(/<img\b([^>]*?)\ssrc="([^"]+)"/g, '<img$1 data-deferred-src="$2"') : html;
  // Figures open full size in a new tab, so diagrams stay readable on phones (pinch to zoom there).
  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    const deferredFig = t.closest("figure")?.querySelector<HTMLImageElement>("img[data-deferred-src]");
    if (deferredFig) {
      e.preventDefault();
      deferredFig.src = deferredFig.dataset.deferredSrc!;
      deferredFig.removeAttribute("data-deferred-src");
      return;
    }
    if (t.tagName === "IMG" && t.closest("figure")) {
      e.preventDefault();
      window.open((t as HTMLImageElement).currentSrc || (t as HTMLImageElement).src, "_blank", "noopener");
    }
  };
  return <div className={cn("rich-content", className)} onClick={onClick} dangerouslySetInnerHTML={{ __html: shown }} />;
}
