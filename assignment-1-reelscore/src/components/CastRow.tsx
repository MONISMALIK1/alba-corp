import Image from "next/image";
import { posterUrl } from "@/lib/tmdb";
import type { CastMember } from "@/lib/types";

export function CastRow({ cast }: { cast: CastMember[] }) {
  if (cast.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Cast</h2>
      <div className="mt-3 flex gap-4 overflow-x-auto pb-2">
        {cast.map((member) => {
          const photo = posterUrl(member.profilePath, "w185");
          return (
            <div key={member.id} className="w-20 shrink-0 text-center">
              <div className="relative aspect-square overflow-hidden rounded-full bg-zinc-800">
                {photo && (
                  <Image src={photo} alt={member.name} fill sizes="80px" className="object-cover" />
                )}
              </div>
              <p className="mt-1 line-clamp-1 text-xs font-medium text-zinc-200">{member.name}</p>
              <p className="line-clamp-1 text-[11px] text-zinc-500">{member.character}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
