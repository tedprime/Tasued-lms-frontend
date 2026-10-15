import crestMark from "../assets/tasued-crest-128.png";
import crestFull from "../assets/tasued-crest.png";
import { cn } from "../lib/cn";

/** TASFUED crest + "TASFUED LMS" wordmark. */
export function Logo({ className, subtitle, compact }: { className?: string; subtitle?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img src={crestMark} alt={compact ? "TASFUED LMS" : ""} width={40} height={40} className="size-10 shrink-0 object-contain" />
      {!compact && (
        <span className="leading-tight">
          <span className="block font-headline text-[15px] font-extrabold tracking-tight text-primary-500">
            TASFUED <span className="text-secondary-500">LMS</span>
          </span>
          {subtitle && <span className="block text-[11px] font-medium text-neutral-500">{subtitle}</span>}
        </span>
      )}
    </span>
  );
}

/** Full crest with motto, for sign-in and other brand moments. Place on a light surface — the motto is black. */
export function Crest({ className, size = 160 }: { className?: string; size?: number }) {
  return (
    <img
      src={crestFull}
      alt="Tai Solarin Federal University of Education crest — Integrity & Selflessness"
      width={size}
      height={size}
      className={cn("object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
