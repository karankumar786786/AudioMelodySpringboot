"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Callback() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/home");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white font-sans">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
}
