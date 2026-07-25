import logoDark from "@/assets/oltrid-logo-dark.png.asset.json";
import logoLight from "@/assets/oltrid-logo-light.png.asset.json";

interface OltridLogoProps {
  className?: string;
}

export function OltridLogo({ className = "h-8 w-8" }: OltridLogoProps) {
  return (
    <>
      <img
        src={logoDark.url}
        alt="Oltrid"
        className={`${className} block dark:hidden object-contain`}
      />
      <img
        src={logoLight.url}
        alt="Oltrid"
        className={`${className} hidden dark:block object-contain`}
      />
    </>
  );
}
