import { useMutation, useQueryClient } from "@tanstack/react-query";

/** A mutation that refreshes the `key` queries plus the cross-module day summary. */
export function useInvalidating<T>(key: string, fn: (arg: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [key] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}
