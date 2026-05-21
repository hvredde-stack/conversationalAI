import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 disabled:bg-slate-300 disabled:text-slate-500",
  secondary:
    "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60",
  ghost:
    "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-60",
};

const sizeClasses: Record<Size, string> = {
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, leftIcon, rightIcon, children, className = "", disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(" ")}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
      <span>{children}</span>
      {!loading && rightIcon}
    </button>
  );
});
