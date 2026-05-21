interface LogoProps {
  size?: number;
  variant?: "default" | "light";
  showWordmark?: boolean;
  className?: string;
}

export function Logo({
  size = 36,
  variant = "default",
  showWordmark = true,
  className = "",
}: LogoProps) {
  const wordmarkColor = variant === "light" ? "text-white" : "text-navy-800";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Geometric C mark inspired by the Concierge AI brand sheet */}
      <div
        className="relative grid place-items-center rounded-xl bg-navy-800 shadow-soft ring-1 ring-gold-400/40"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 32 32"
          width={size * 0.6}
          height={size * 0.6}
          fill="none"
          stroke="#D4AF37"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Hex-styled C: arcs forming a stylized 'C' inside a hexagon */}
          <path d="M16 3 L27 9 L27 23 L16 29 L5 23 L5 9 Z" stroke="#D4AF37" />
          <path d="M21 11.5 a7 7 0 1 0 0 9" stroke="#D4AF37" />
        </svg>
      </div>
      {showWordmark && (
        <div className="leading-tight">
          <div className={`text-[15px] font-bold tracking-tight ${wordmarkColor}`}>
            Concierge<span className="text-gold-400">AI</span>
          </div>
          <div
            className={
              variant === "light"
                ? "text-[10px] uppercase tracking-[0.18em] text-navy-200/80"
                : "text-[10px] uppercase tracking-[0.18em] text-navy-400"
            }
          >
            Your intelligent assistant
          </div>
        </div>
      )}
    </div>
  );
}
