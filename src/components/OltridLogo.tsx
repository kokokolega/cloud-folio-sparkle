import logoImg from "@/assets/fylix-logo.png";

interface OltridLogoProps {
  className?: string;
}

export function OltridLogo({ className = "h-8 w-8" }: OltridLogoProps) {
  return (
    <img
      src={logoImg}
      alt="Oltrid"
      className={`${className} rounded-lg object-contain`}
    />
  );
}
