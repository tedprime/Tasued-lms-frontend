import { useEffect, useState } from "react";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const h = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", h);
    setMatches(mq.matches);
    return () => mq.removeEventListener("change", h);
  }, [query]);
  return matches;
}

/** Mobile breakpoint used by SLAN's dashboard sidebar. */
export const useIsMobile = () => useMediaQuery("(max-width: 767px)");
