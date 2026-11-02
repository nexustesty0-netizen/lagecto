import { availabilityDetail, isOnOrder } from "@/lib/product-availability";

export function AvailabilityNote({
  availability,
  stock,
  type,
  className = "",
}: {
  availability?: string | null;
  stock?: number | null;
  type?: string | null;
  className?: string;
}) {
  if (type === "service") return null;
  const onOrder = isOnOrder(availability);
  const out = !onOrder && Number(stock || 0) <= 0;
  return (
    <p
      className={className}
      style={{ color: out ? "#C2413B" : onOrder ? "var(--sf-secondary, #2E8B57)" : "var(--sf-primary, #0B6E4F)" }}
    >
      {availabilityDetail(availability, stock, type)}
    </p>
  );
}

export function AvailabilityBadge({ availability, type }: { availability?: string | null; type?: string | null }) {
  if (type === "service" || !isOnOrder(availability)) return null;
  return (
    <span className="absolute bottom-1.5 left-1.5 z-[2] rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold text-[#0B6E4F] sm:bottom-2 sm:left-2 sm:px-2 sm:text-[11px]">
      On order
    </span>
  );
}
