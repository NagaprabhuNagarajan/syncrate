import * as React from "react";
import { cn } from "@/utils/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm",
        "transition-[border-color,box-shadow] duration-150 ease-out",
        "placeholder:text-muted-foreground",
        "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/30",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
