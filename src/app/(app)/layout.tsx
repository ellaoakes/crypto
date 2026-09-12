import type { ReactNode } from "react";

import { Header } from "@/components/layout/Header";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
    </>
  );
}
