import { DestinationCardSkeleton } from "@/components/discover/DestinationCardSkeleton";
import { Container } from "@/components/ui/Container";

export default function DiscoverLoading() {
  return (
    <Container className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="h-4 w-24 animate-pulse rounded bg-teal-100" />
        <div className="h-6 w-56 animate-pulse rounded bg-teal-100" />
        <div className="h-4 w-72 animate-pulse rounded bg-teal-50" />
      </div>
      <div aria-live="polite" aria-busy="true" className="sr-only">
        Loading suggested destinations
      </div>
      <div className="flex flex-col gap-4">
        <DestinationCardSkeleton />
        <DestinationCardSkeleton />
        <DestinationCardSkeleton />
      </div>
    </Container>
  );
}
