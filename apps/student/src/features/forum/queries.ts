import { useQuery } from "@tanstack/react-query";
import { api } from "@tasued/api-client";

export function useForumCategories() {
  return useQuery({ queryKey: ["forum", "categories"], queryFn: () => api.forum.categories(), staleTime: 5 * 60_000 });
}

export const threadKey = (id: string) => ["forum", "thread", id] as const;
