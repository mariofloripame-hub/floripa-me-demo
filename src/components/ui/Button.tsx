import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const base = "rounded-pill px-6 py-3 font-display font-extrabold disabled:opacity-40";
  const variantClass =
    variant === "primary"
      ? "bg-gradient-to-r from-turquoise to-blue text-graphite"
      : "bg-transparent text-ink-dim";
  return <button type="button" className={`${base} ${variantClass} ${className}`} {...props} />;
}
