import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type AlertTone = "error" | "info" | "success";

const toneClasses: Record<AlertTone, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-teal-200 bg-teal-50 text-teal-900",
  success: "border-green-200 bg-green-50 text-green-900",
};

export function Alert({
  tone = "info",
  children,
}: {
  tone?: AlertTone;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-lg border px-4 py-3 text-sm", toneClasses[tone])}
    >
      {children}
    </div>
  );
}
