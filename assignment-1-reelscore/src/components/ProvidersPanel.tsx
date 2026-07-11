import Image from "next/image";
import type { WatchProviders } from "@/lib/types";

const PROVIDER_LOGO_BASE = "https://image.tmdb.org/t/p/w45";

export function ProvidersPanel({ providers }: { providers: WatchProviders | null }) {
  const groups = providers
    ? [
        { label: "Stream", list: providers.flatrate },
        { label: "Rent", list: providers.rent },
        { label: "Buy", list: providers.buy },
      ].filter((g) => g.list.length > 0)
    : [];

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Where to watch
      </h2>
      {groups.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">No streaming info available for your region.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {groups.map((g) => (
            <div key={g.label} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-xs text-zinc-500">{g.label}</span>
              <div className="flex flex-wrap gap-2">
                {g.list.map((p) => (
                  <Image
                    key={p.id}
                    src={`${PROVIDER_LOGO_BASE}${p.logoPath}`}
                    alt={p.name}
                    title={p.name}
                    width={32}
                    height={32}
                    className="rounded-md"
                  />
                ))}
              </div>
            </div>
          ))}
          {providers?.link && (
            <a
              href={providers.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs text-amber-400 hover:underline"
            >
              View all options on TMDB
            </a>
          )}
        </div>
      )}
    </section>
  );
}
