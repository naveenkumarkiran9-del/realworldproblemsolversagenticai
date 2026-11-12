import logoGem from "@/assets/logo-gem.png.asset.json";

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <img
      src={logoGem.url}
      alt="TradePilot AI logo"
      width={size}
      height={size}
      className="shrink-0 drop-shadow-[0_0_12px_hsl(var(--ai)/0.45)]"
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
