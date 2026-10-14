import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2, AlertTriangle, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "./primitives";

/* ───────────── Modal ───────────── */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  dismissible?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;
  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-tertiary-500/40 backdrop-blur-[2px]" onClick={dismissible ? onClose : undefined} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("relative flex max-h-[92vh] w-full animate-fade-in-up flex-col rounded-t-2xl bg-white shadow-pop outline-none sm:rounded-2xl", width)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-4">
          <div>
            <h2 id={titleId} className="font-headline text-lg font-extrabold text-tertiary-500">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
          </div>
          {dismissible && (
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100">
              <X className="size-5" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "primary",
  loading,
  children,
  confirmDisabled,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  tone?: "primary" | "danger";
  loading?: boolean;
  children?: ReactNode;
  confirmDisabled?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="text-sm text-neutral-600">{description}</p>}
      {children}
    </Modal>
  );
}

/* ───────────── Drawer (side panel) ───────────── */

export function Drawer({ open, onClose, title, children, footer, width = 480 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 animate-fade-in bg-tertiary-500/30" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" className="absolute top-0 right-0 flex h-full w-full flex-col bg-white shadow-pop" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h2 className="font-headline text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"><X className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-4">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

/* ───────────── Toasts ───────────── */

type ToastTone = "success" | "error" | "info";
interface ToastItem { id: number; tone: ToastTone; title: string; description?: string }

const ToastCtx = createContext<{ push: (t: Omit<ToastItem, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed right-4 bottom-4 left-4 z-[200] flex flex-col items-end gap-2 sm:left-auto" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className="pointer-events-auto flex w-full max-w-sm animate-fade-in-up items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-pop">
              {t.tone === "success" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary-500" /> : t.tone === "error" ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" /> : <Info className="mt-0.5 size-5 shrink-0 text-info" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-tertiary-500">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-neutral-500">{t.description}</p>}
              </div>
              <button type="button" aria-label="Dismiss" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))} className="text-neutral-400 hover:text-neutral-600"><X className="size-4" /></button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return {
    success: (title: string, description?: string) => ctx.push({ tone: "success", title, description }),
    error: (title: string, description?: string) => ctx.push({ tone: "error", title, description }),
    info: (title: string, description?: string) => ctx.push({ tone: "info", title, description }),
  };
}

/* ───────────── Tabs (from SLAN's TabSwitcher) ───────────── */

export function Tabs<K extends string>({ tabs, value, onChange, className }: { tabs: { key: K; label: ReactNode; count?: number }[]; value: K; onChange: (k: K) => void; className?: string }) {
  return (
    <div
      role="tablist"
      // Bottom rule drawn as an inset shadow (not a border + negative margins) so the
      // horizontally scrollable row never overflows vertically.
      className={cn("flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-neutral-200)] [scrollbar-width:thin]", className)}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          type="button"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "relative inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
            value === t.key ? "border-primary-500 text-primary-500" : "border-transparent text-neutral-500 hover:text-tertiary-500",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className={cn("rounded-full px-1.5 text-[11px]", value === t.key ? "bg-primary-50" : "bg-neutral-100")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SegmentedControl<K extends string>({ options, value, onChange, className }: { options: { key: K; label: ReactNode }[]; value: K; onChange: (k: K) => void; className?: string }) {
  return (
    <div className={cn("inline-flex rounded-lg bg-neutral-100 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition-colors", value === o.key ? "bg-white text-tertiary-500 shadow-sm" : "text-neutral-500 hover:text-tertiary-500")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────── Dropdown menu (from SLAN's DropdownMenu, simplified) ───────────── */

export function Menu({ trigger, items, align = "right" }: { trigger: ReactNode; items: ({ label: ReactNode; onClick: () => void; danger?: boolean; icon?: ReactNode; disabled?: boolean } | "divider")[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      {open && (
        <div role="menu" className={cn("absolute z-50 mt-1 min-w-[180px] animate-fade-in rounded-xl border border-neutral-200 bg-white py-1.5 shadow-pop", align === "right" ? "right-0" : "left-0")}>
          {items.map((it, i) =>
            it === "divider" ? (
              <div key={i} className="my-1 border-t border-neutral-100" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className={cn("flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-neutral-50 disabled:opacity-40", it.danger ? "text-danger" : "text-tertiary-500")}
              >
                {it.icon}
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────── Table ───────────── */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}
export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{children}</thead>;
}
export function TH({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 whitespace-nowrap", className)}>{children}</th>;
}
export function TR({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <tr onClick={onClick} className={cn("border-b border-neutral-100 last:border-0", onClick && "cursor-pointer hover:bg-neutral-50", className)}>{children}</tr>;
}
export function TD({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("px-4 py-3 align-middle text-tertiary-500", className)}>{children}</td>;
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-neutral-500">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-md p-1.5 hover:bg-neutral-100 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
        <span className="px-2 font-medium text-tertiary-500">{page} / {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-md p-1.5 hover:bg-neutral-100 disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
      </div>
    </div>
  );
}
