import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface OltridLogoProps {
  className?: string;
}

export const OltridLogo = forwardRef<HTMLSpanElement, OltridLogoProps>(
  ({ className = "h-8 w-8", ...rest }, ref) => (
    <span ref={ref} className={cn("inline-flex shrink-0 text-foreground", className)} {...rest}>
      <svg
        viewBox="0 0 32 32"
        role="img"
        aria-label="Oltrid"
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="16" cy="16" r="14" fill="currentColor" />
        <path
          d="M22.8 9.4c-5.9.4-10.1 2.5-12.1 6.2-1.5 2.8-.8 5.6 1.7 7.1 2.5 1.5 5.5.6 7-2.1 1.3-2.4 1.6-5.4 3.4-11.2Z"
          fill="hsl(var(--background))"
        />
        <path
          d="M10.5 22.6c1.9-3.2 4.6-5.7 8.2-7.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
);

OltridLogo.displayName = "OltridLogo";
