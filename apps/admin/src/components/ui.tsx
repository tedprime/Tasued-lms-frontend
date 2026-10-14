/** Re-exports the shared UI kit plus a few small local additions the kit doesn't provide. */
import type { ReactNode } from "react";
export * from "@tasued/ui";

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}
