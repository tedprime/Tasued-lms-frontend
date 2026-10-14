import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { errorMessage } from "@tasued/api-client";
import { useToast } from "@tasued/ui";

/**
 * useMutation + toasts + query invalidation.
 * `success` may be a string or a function of the result; `invalidate` is a list of key prefixes.
 */
export function useApiMutation<TVars, TResult>({
  mutationFn,
  success,
  errorTitle = "Couldn't save",
  invalidate = [],
  onSuccess,
}: {
  mutationFn: (v: TVars) => Promise<TResult>;
  success?: string | ((r: TResult, v: TVars) => string);
  errorTitle?: string;
  invalidate?: QueryKey[];
  onSuccess?: (r: TResult, v: TVars) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn,
    onSuccess: async (r, v) => {
      await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k })));
      if (success) toast.success(typeof success === "string" ? success : success(r, v));
      onSuccess?.(r, v);
    },
    onError: (e) => toast.error(errorTitle, errorMessage(e)),
  });
}

/** Minimal form-errors helper: returns errors object; empty when valid. */
export type Errors<K extends string> = Partial<Record<K, string>>;
export const hasErrors = (e: object) => Object.values(e).some(Boolean);
