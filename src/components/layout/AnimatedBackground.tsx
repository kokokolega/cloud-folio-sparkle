import { useBackgroundTheme, BgTheme } from "@/hooks/useBackgroundTheme";

function AuroraBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] animate-[aurora-spin_20s_linear_infinite]">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute top-1/2 right-1/4 w-80 h-80 rounded-full bg-accent/20 blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 rounded-full bg-secondary/30 blur-[110px]" />
      </div>
    </div>
  );
}

function ParticlesBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-primary/10 animate-[float_var(--dur)_ease-in-out_infinite_var(--delay)]"
          style={{
            width: `${Math.random() * 6 + 2}px`,
            height: `${Math.random() * 6 + 2}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            "--dur": `${Math.random() * 8 + 6}s`,
            "--delay": `${Math.random() * -10}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function WavesBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <svg className="absolute bottom-0 w-full h-64 opacity-20" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path className="animate-[wave-shift_8s_ease-in-out_infinite] fill-primary/30"
          d="M0,224L48,213.3C96,203,192,181,288,186.7C384,192,480,224,576,218.7C672,213,768,171,864,165.3C960,160,1056,192,1152,197.3C1248,203,1344,181,1392,170.7L1440,160L1440,320L0,320Z" />
        <path className="animate-[wave-shift_12s_ease-in-out_infinite_reverse] fill-accent/20"
          d="M0,288L48,272C96,256,192,224,288,213.3C384,203,480,213,576,229.3C672,245,768,267,864,261.3C960,256,1056,224,1152,208C1248,192,1344,192,1392,192L1440,192L1440,320L0,320Z" />
      </svg>
    </div>
  );
}

function GradientMeshBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 animate-[mesh-move_15s_ease-in-out_infinite]"
        style={{
          background: `
            radial-gradient(ellipse at 20% 50%, hsl(var(--primary) / 0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, hsl(var(--accent) / 0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 40% 80%, hsl(var(--secondary) / 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 60%, hsl(var(--primary) / 0.08) 0%, transparent 50%)
          `
        }}
      />
    </div>
  );
}

function StarfieldBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-foreground/20 animate-[twinkle_var(--dur)_ease-in-out_infinite_var(--delay)]"
          style={{
            width: `${Math.random() * 3 + 1}px`,
            height: `${Math.random() * 3 + 1}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            "--dur": `${Math.random() * 3 + 2}s`,
            "--delay": `${Math.random() * -5}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function RainBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {Array.from({ length: 60 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent animate-[rain-fall_var(--dur)_linear_infinite_var(--delay)]"
          style={{
            height: `${Math.random() * 80 + 40}px`,
            left: `${Math.random() * 100}%`,
            "--dur": `${Math.random() * 0.8 + 0.4}s`,
            "--delay": `${Math.random() * -2}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function MatrixBackground() {
  const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノ01";
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {Array.from({ length: 25 }).map((_, i) => (
        <div
          key={i}
          className="absolute top-0 animate-[matrix-fall_var(--dur)_linear_infinite_var(--delay)] text-primary/25 text-xs font-mono leading-tight whitespace-pre"
          style={{
            left: `${Math.random() * 100}%`,
            "--dur": `${Math.random() * 6 + 4}s`,
            "--delay": `${Math.random() * -10}s`,
          } as React.CSSProperties}
        >
          {Array.from({ length: 20 }).map((_, j) => (
            <div key={j}>{chars[Math.floor(Math.random() * chars.length)]}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

function FirefliesBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-[firefly_var(--dur)_ease-in-out_infinite_var(--delay)]"
          style={{
            width: `${Math.random() * 4 + 2}px`,
            height: `${Math.random() * 4 + 2}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: `radial-gradient(circle, hsl(48 90% 60% / 0.8), hsl(48 90% 60% / 0))`,
            boxShadow: `0 0 6px 2px hsl(48 90% 60% / 0.3)`,
            "--dur": `${Math.random() * 6 + 4}s`,
            "--delay": `${Math.random() * -8}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function ReadingWarmBackground() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none"
      style={{
        background: `radial-gradient(ellipse at 50% 0%, hsl(35 60% 50% / 0.06) 0%, transparent 70%),
                     radial-gradient(ellipse at 50% 100%, hsl(25 50% 40% / 0.04) 0%, transparent 60%)`
      }}
    />
  );
}

function ReadingCoolBackground() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none"
      style={{
        background: `radial-gradient(ellipse at 50% 0%, hsl(210 40% 50% / 0.06) 0%, transparent 70%),
                     radial-gradient(ellipse at 50% 100%, hsl(220 30% 40% / 0.04) 0%, transparent 60%)`
      }}
    />
  );
}

function CustomImageBackground() {
  const { customImageUrl } = useBackgroundTheme();
  if (!customImageUrl) return null;
  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${customImageUrl})` }}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]" />
    </div>
  );
}

const backgrounds: Record<BgTheme, (() => JSX.Element) | null> = {
  none: null,
  aurora: AuroraBackground,
  particles: ParticlesBackground,
  waves: WavesBackground,
  "gradient-mesh": GradientMeshBackground,
  starfield: StarfieldBackground,
  rain: RainBackground,
  matrix: MatrixBackground,
  fireflies: FirefliesBackground,
  "reading-warm": ReadingWarmBackground,
  "reading-cool": ReadingCoolBackground,
  "custom-image": CustomImageBackground,
};

export function AnimatedBackground() {
  const { bgTheme } = useBackgroundTheme();
  const Component = backgrounds[bgTheme];
  if (!Component) return null;
  return <Component />;
}
