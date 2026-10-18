/** Map shared notification links to routes available in the staff portal. */
export function adminNotificationPath(path: string): string {
  if (/^\/forum\/threads\/[^/]+$/.test(path)) return path;
  if (/^\/forum\/(?!threads\/)([^/]+)$/.test(path))
    return path.replace("/forum/", "/forum/threads/");
  if (/^\/(assignments|quizzes)\/[^/]+$/.test(path))
    return "/" + path.split("/")[1];
  if (
    /^\/courses\/[^/]+(?:\/(?:classes|recordings|assignments|quizzes|forum|gradebook|grades|attendance|announcements|content|students))?$/.test(
      path,
    )
  )
    return path.replace(/\/grades$/, "/gradebook");
  if (
    [
      "/",
      "/classes",
      "/recordings",
      "/assignments",
      "/quizzes",
      "/forum",
      "/announcements",
      "/attendance",
      "/gradebook",
      "/reports",
      "/profile",
    ].includes(path)
  )
    return path;
  return "/";
}
