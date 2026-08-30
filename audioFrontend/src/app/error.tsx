"use client";

import { SomethingWentWrongPage } from "@/components/ErrorPages";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SomethingWentWrongPage error={error} reset={reset} />;
}
