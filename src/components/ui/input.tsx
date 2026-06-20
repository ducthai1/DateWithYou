import { forwardRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
};

/**
 * Universal Input component with Material-style floating label, password toggle,
 * and seamless border handling.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, prefixIcon, suffixIcon, id, type, placeholder, required, value, ...props },
  ref,
) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const actualType = isPassword ? (showPassword ? "text" : "password") : type;

  // Only use floating text if label is explicitly provided
  const floatingText = label;

  return (
    <div className="w-full space-y-1.5">
      <div className="relative w-full h-[48px] rounded-xl bg-card">
        {prefixIcon && (
          <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 z-20 flex items-center">
            {prefixIcon}
          </span>
        )}

        <input
          ref={ref}
          id={id}
          type={actualType}
          required={required}
          value={value}
          // If using floating label, hide native placeholder. Else use native placeholder.
          placeholder={floatingText ? " " : placeholder}
          className={cn(
            "peer relative z-10 h-full w-full rounded-xl bg-transparent text-sm outline-none transition-all",
            "disabled:cursor-not-allowed disabled:opacity-60",
            // Fix for Chrome autofill background overriding text color
            "[&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_var(--card)]",
            "[&:-webkit-autofill]:-webkit-text-fill-color-foreground",
            prefixIcon ? "pl-10" : "pl-4",
            (suffixIcon || isPassword) ? "pr-10" : "pr-4",
            // If no floating label, use standard placeholder color
            !floatingText && "placeholder:text-muted-foreground/60",
            className,
          )}
          {...props}
        />

        {floatingText && (
          <label
            htmlFor={id}
            className={cn(
              "absolute z-30 pointer-events-none transition-all duration-200 text-muted-foreground",
              "top-1/2 -translate-y-1/2 text-sm",
              prefixIcon ? "left-9" : "left-3",
              "peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs peer-focus:text-accent peer-focus:left-3",
              "peer-[&:not(:placeholder-shown)]:top-0 peer-[&:not(:placeholder-shown)]:-translate-y-1/2 peer-[&:not(:placeholder-shown)]:text-xs peer-[&:not(:placeholder-shown)]:left-3",
              "peer-[&:-webkit-autofill]:top-0 peer-[&:-webkit-autofill]:-translate-y-1/2 peer-[&:-webkit-autofill]:text-xs peer-[&:-webkit-autofill]:left-3",
            )}
          >
            {floatingText}
            {required && <span className="text-destructive ml-0.5">*</span>}
          </label>
        )}

        <fieldset
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-0 left-0 right-0 z-20 m-0 rounded-xl border border-border px-2 transition-all",
            floatingText ? "-top-[5px]" : "top-0",
            "peer-focus:border-accent peer-focus:border-2",
            // Target the legend width based on the peer's state
            "peer-focus:[&>legend]:max-w-full peer-[&:not(:placeholder-shown)]:[&>legend]:max-w-full peer-[&:-webkit-autofill]:[&>legend]:max-w-full",
          )}
        >
          {floatingText && (
            <legend className="invisible h-[10px] max-w-0 overflow-hidden whitespace-nowrap p-0 text-xs transition-[max-width] duration-200">
              <span className="inline-block px-1">
                {floatingText}
                {required && <span className="ml-0.5">*</span>}
              </span>
            </legend>
          )}
        </fieldset>

        {(suffixIcon || isPassword) && (
          <span className="absolute inset-y-0 right-0 z-20 flex items-center justify-center w-10">
            {isPassword ? (
              <button
                type="button"
                tabIndex={-1}
                className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:opacity-70 touch-manipulation -mr-1"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            ) : (
              suffixIcon
            )}
          </span>
        )}
      </div>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
});
