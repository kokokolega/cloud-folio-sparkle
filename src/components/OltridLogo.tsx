interface OltridLogoProps {
  className?: string;
}

export function OltridLogo({ className = "h-8 w-8" }: OltridLogoProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="oltrid-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(var(--foreground))" />
          <stop offset="100%" stopColor="hsl(var(--foreground) / 0.7)" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#oltrid-grad)" />
      <path
        d="M24 12C17.373 12 12 17.373 12 24s5.373 12 12 12 12-5.373 12-12S30.627 12 24 12zm0 20c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8z"
        fill="hsl(var(--background))"
        fillOpacity="0.95"
      />
      <circle cx="24" cy="24" r="3.5" fill="hsl(var(--background))" fillOpacity="0.95" />
      <path
        d="M24 16v-2M24 34v-2M16 24h-2M34 24h-2"
        stroke="hsl(var(--background))"
        strokeOpacity="0.6"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
