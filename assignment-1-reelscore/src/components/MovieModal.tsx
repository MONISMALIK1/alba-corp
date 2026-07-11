"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function MovieModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
    }
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm"
      onClick={() => router.back()}
    >
      <div
        className="relative mx-auto my-8 max-w-5xl rounded-2xl bg-zinc-950 shadow-2xl ring-1 ring-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => router.back()}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-full bg-zinc-900/90 p-2 text-lg leading-none text-zinc-300 hover:text-white"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
