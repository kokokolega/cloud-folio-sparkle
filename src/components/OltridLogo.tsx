import { forwardRef } from "react";
import logoDark from "@/assets/oltrid-logo-dark.png.asset.json";
import logoLight from "@/assets/oltrid-logo-light.png.asset.json";

interface OltridLogoProps {
  className?: string;
}

export const OltridLogo = forwardRef<HTMLSpanElement, OltridLogoProps>(
  ({ className = "h-8 w-8", ...rest }, ref) => (
    <span ref={ref} style={{ display: "contents" }} {...rest}>
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
    </span>
  )
);

OltridLogo.displayName = "OltridLogo";
