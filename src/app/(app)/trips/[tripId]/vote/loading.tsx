import { Container } from "@/components/ui/Container";

export default function VoteLoading() {
  return (
    <Container className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="h-4 w-32 animate-pulse rounded bg-teal-100" />
        <div className="h-6 w-48 animate-pulse rounded bg-teal-100" />
      </div>

      <div aria-live="polite" aria-busy="true" className="sr-only">
        Loading the vote
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-teal-100 p-4">
        <div className="h-4 w-40 animate-pulse rounded bg-teal-100" />
        <div className="h-2 animate-pulse rounded-full bg-teal-100" />
      </div>

      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-2xl border border-teal-100 p-4"
          >
            <div className="h-5 w-1/3 animate-pulse rounded bg-teal-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-teal-50" />
            <div className="h-11 animate-pulse rounded-lg bg-teal-100" />
          </div>
        ))}
      </div>
    </Container>
  );
}
