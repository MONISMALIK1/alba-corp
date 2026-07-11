import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-[family-name:var(--font-display)] text-2xl italic text-zinc-200">
        Page not found
      </p>
      <Link href="/" className="text-sm text-amber-400 hover:underline">
        ← Back to movies
      </Link>
    </main>
  );
}
