import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "border-transparent bg-blue-600 text-white",
  secondary: "border-transparent bg-slate-100 text-slate-900",
  destructive: "border-transparent bg-red-600 text-white",
  outline: "text-slate-700",
  success: "border-transparent bg-emerald-600 text-white",
  warning: "border-transparent bg-amber-500 text-white",
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
