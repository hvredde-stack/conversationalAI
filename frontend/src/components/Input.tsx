import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, type = "text", className = "", id, ...rest },
  ref,
) {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && reveal ? "text" : type;
  const inputId = id ?? rest.name;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          type={inputType}
          className={[
            "block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900",
            "placeholder:text-slate-400 transition-shadow",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-200"
              : "border-slate-200 focus:border-brand-500 focus:ring-brand-200",
            leftIcon ? "pl-10" : "",
            isPassword ? "pr-10" : "",
            className,
          ].join(" ")}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            tabIndex={-1}
            aria-label={reveal ? "Hide password" : "Show password"}
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});
