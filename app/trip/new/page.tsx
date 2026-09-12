import { Header } from "@/components/Header";
import { CreateTripForm } from "@/components/CreateTripForm";

export default function NewTripPage() {
  return (
    <>
      <Header />
      <main className="px-6 py-16">
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-heading text-3xl font-bold">Create a trip</h1>
          <p className="mt-3 mb-8 text-navy-soft">
            Takes a minute. You&rsquo;ll get a link to share with everyone, and a private dashboard link
            to keep for yourself.
          </p>
        </div>
        <CreateTripForm />
      </main>
    </>
  );
}
