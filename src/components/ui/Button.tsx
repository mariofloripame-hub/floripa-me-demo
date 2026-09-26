import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
  size?: "md" | "sm";
}

export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  const sizeClass = size === "sm" ? "px-5 py-2 text-sm" : "px-6 py-3";
  const base = `rounded-pill ${sizeClass} font-display font-extrabold disabled:opacity-40`;
  const variantClass =
    variant === "primary"
      ? "bg-gradient-to-r from-turquoise to-blue text-graphite"
      : "bg-transparent text-ink-dim";
  return <button type="button" className={`${base} ${variantClass} ${className}`} {...props} />;
}
