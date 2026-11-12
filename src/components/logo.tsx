import logoImage from "@/assets/data-analytics-logo.png.asset.json";

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <img
      src={logoImage.url}
      alt="TradePilot AI logo"
      width={size}
      height={size}
      className="shrink-0 rounded-lg object-cover shadow-glow"
      style={{ width: size, height: size }}
    />
  );
}
