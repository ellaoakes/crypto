import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  hint?: string;
}

/**
 * A plain, form-submittable text input. Deliberately has no client-side
 * state of its own so it can render as a Server Component inside forms
 * that use native submission or Server Actions.
 */
export function Input({
  label,
  name,
  id,
  error,
  hint,
  className,
  ...props
}: InputProps) {
  const inputId = id ?? name;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-teal-950">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={cn(hintId, errorId) || undefined}
        className={cn(
          "h-11 w-full rounded-lg border px-3 text-base text-teal-950 placeholder:text-teal-950/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1",
          error ? "border-red-400" : "border-teal-200",
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-teal-950/60">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
