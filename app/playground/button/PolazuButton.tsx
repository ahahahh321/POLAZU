import type { ComponentPropsWithoutRef } from "react";
import "./polazu-button.css";

export type PolazuButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "neutral";
  size?: "sm" | "md" | "lg";
};

export function PolazuButton({
  variant = "primary", size = "md", className = "", type = "button", ...props
}: PolazuButtonProps) {
  return <button {...props} type={type} className={`polazu-button ${className}`}
    data-variant={variant} data-size={size} />;
}
