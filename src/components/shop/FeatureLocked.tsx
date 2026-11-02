import { EmptyState } from "@/components/ui/primitives";
import { FEATURE_LABELS, PACKAGE_META, packageRequiredFor } from "@/lib/packages";
import Link from "next/link";

export function FeatureLocked({ feature, reason }: { feature: string; reason?: "package" | "admin" }) {
  const label = FEATURE_LABELS[feature] || feature.replaceAll("_", " ");
  const required = packageRequiredFor(feature);
  const name = required === "free" ? "Free" : PACKAGE_META[required].name;
  if (reason === "admin") {
    return (
      <EmptyState
        title={`${label} is turned off`}
        body="LaGecto has disabled this tool for your shop. Your existing records are kept. Contact support if you need it restored."
        action={
          <Link href="/support" className="lg-btn">
            Contact support
          </Link>
        }
      />
    );
  }
  return (
    <EmptyState
      title={`Available on ${name}`}
      body={`${label} is included in ${name} and higher. Your shop stays open on Free — upgrade from Subscription to unlock this.`}
      action={
        <Link href="/shop/subscription" className="lg-btn">
          View packages
        </Link>
      }
    />
  );
}

export function FeatureHint({ feature }: { feature: string }) {
  const required = packageRequiredFor(feature);
  if (required === "free") {
    return <p className="text-xs text-[#6B7280]">Included on Free.</p>;
  }
  return (
    <p className="text-xs text-[#6B7280]">
      Premium on {PACKAGE_META[required].name}.{" "}
      <Link href="/shop/subscription" className="font-semibold text-[#0B6E4F]">
        View packages
      </Link>
    </p>
  );
}
