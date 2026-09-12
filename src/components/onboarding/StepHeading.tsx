export function StepHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-1.5">
      {eyebrow ? (
        <p className="text-sm font-medium uppercase tracking-wide text-white/70">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      {subtitle ? <p className="text-white/80">{subtitle}</p> : null}
    </div>
  );
}
