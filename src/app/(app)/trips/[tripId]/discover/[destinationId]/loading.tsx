import { Container } from "@/components/ui/Container";

export default function DestinationDetailLoading() {
  return (
    <Container className="flex flex-1 flex-col gap-4">
      <div className="h-4 w-40 animate-pulse rounded bg-teal-100" />

      <div className="h-40 animate-pulse rounded-2xl bg-teal-100" aria-hidden="true" />

      <div aria-live="polite" aria-busy="true" className="sr-only">
        Loading destination details
      </div>

      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex flex-col gap-2 rounded-xl border border-teal-100 p-4">
            <div className="h-4 w-1/2 animate-pulse rounded bg-teal-100" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-teal-50" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-teal-50" />
          </div>
        ))}
      </div>
    </Container>
  );
}
