import { useMutation, useQueryClient } from "@tanstack/react-query";

/** A mutation that refreshes the `key` queries plus the cross-module day summary. */
export function useInvalidating<T, R = unknown>(key: string | string[], fn: (arg: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const k of typeof key === "string" ? [key] : key) qc.invalidateQueries({ queryKey: [k] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}

/** Task changes also move project progress. */
export const TASK_KEYS = ["tasks", "projects"];
