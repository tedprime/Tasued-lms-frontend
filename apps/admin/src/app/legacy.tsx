import { Navigate, useLocation } from "react-router-dom";

/** `/offerings/...` (pre-courses URLs, e.g. in old notifications) → `/courses/...`. */
export function LegacyOfferingRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={pathname.replace(/^\/offerings/, "/courses") + search} replace />;
}
