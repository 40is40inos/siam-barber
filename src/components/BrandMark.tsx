import { shop } from "@/lib/config";

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span className="flex items-center gap-3">
      <span className="pole shrink-0" style={{ width: size, height: size }} aria-hidden>
        <span className="pole__stripes" />
      </span>
      <span className="font-display text-[1.05rem] font-bold tracking-tight whitespace-nowrap">{shop.name}</span>
    </span>
  );
}

export function Ambient() {
  return (
    <div className="ambient" aria-hidden>
      <div className="ambient__glow ambient__glow--a" />
      <div className="ambient__glow ambient__glow--b" />
      <div className="ambient__grain" />
    </div>
  );
}
