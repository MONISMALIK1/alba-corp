import { DetailSkeleton } from "@/components/Skeletons";
import { MovieModal } from "@/components/MovieModal";

export default function Loading() {
  return (
    <MovieModal>
      <DetailSkeleton />
    </MovieModal>
  );
}
