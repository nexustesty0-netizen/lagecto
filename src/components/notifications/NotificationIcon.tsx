import {
  Bell,
  Boxes,
  CreditCard,
  Headphones,
  HelpCircle,
  Megaphone,
  MessageCircle,
  Package,
  Receipt,
  Shield,
  Star,
  Store,
  User,
} from "lucide-react";
import { noticeKind } from "@/lib/notifications";

export function NotificationIcon({ type, className = "h-4 w-4" }: { type?: string | null; className?: string }) {
  const kind = noticeKind(type);
  const Icon =
    kind === "message"
      ? MessageCircle
      : kind === "order" || kind === "preorder" || kind === "pre-order"
        ? Package
        : kind === "enquiry" || kind === "request"
          ? HelpCircle
          : kind === "receipt"
            ? Receipt
            : kind === "stock"
              ? Boxes
              : kind === "support"
                ? Headphones
                : kind === "billing" || kind === "subscription" || kind === "payment"
                  ? CreditCard
                  : kind === "review"
                    ? Star
                    : kind === "security"
                      ? Shield
                      : kind === "registration" || kind === "verification"
                        ? Store
                        : kind === "account"
                          ? User
                          : kind === "announcement" || kind === "admin"
                            ? Megaphone
                            : Bell;
  return <Icon className={className} aria-hidden />;
}
