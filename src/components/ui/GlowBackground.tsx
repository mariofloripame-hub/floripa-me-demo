export function GlowBackground({ variant = "turquoise" }: { variant?: "turquoise" | "coral" }) {
  const color = variant === "coral" ? "#FF7A59" : "#00E6C8";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -left-16 -top-16 h-64 w-64 rounded-full opacity-30 blur-2xl"
        style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
      />
    </div>
  );
}
