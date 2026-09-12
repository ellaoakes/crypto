import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex flex-1 items-center justify-center py-16"
    >
      <Spinner className="size-6 text-teal-700" />
    </div>
  );
}
