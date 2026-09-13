import { Container } from "@/components/ui/Container";

export default function TripLoading() {
  return (
    <Container className="flex flex-1 flex-col gap-6">
      <div aria-live="polite" aria-busy="true" className="sr-only">
        Loading the trip
      </div>

      <div className="-mx-4 h-64 animate-pulse bg-teal-100 sm:mx-0 sm:rounded-3xl" />

      <div className="flex flex-col gap-2 rounded-2xl border border-teal-100 p-4">
        <div className="h-4 w-28 animate-pulse rounded bg-teal-100" />
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="size-9 animate-pulse rounded-full bg-teal-100" />
            <div className="h-3 w-32 animate-pulse rounded bg-teal-50" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-20 animate-pulse rounded-2xl border border-teal-100 bg-teal-50/40" />
        ))}
      </div>
    </Container>
  );
}
