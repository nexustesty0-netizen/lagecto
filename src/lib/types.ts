export type UserRole = "customer" | "shop_owner" | "admin";
export type AccountStatus = "active" | "locked" | "suspended" | "disabled";

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  username: string | null;
  username_normalized: string | null;
  last_username_change_at: string | null;
  role: UserRole;
  account_status: AccountStatus;
  avatar_url: string | null;
  address: string | null;
  last_login_at: string | null;
  created_at: string;
  admin_role?: "super_admin" | "admin" | "manager" | "staff" | "clerk" | null;
};

export type Shop = {
  id: string;
  name: string;
  slug?: string | null;
  login_shop_id: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_email: string;
  category: string;
  provider_type: "products" | "services" | "both";
  address: string | null;
  phone: string | null;
  email: string | null;
  status: "active" | "inactive" | "pending";
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  about: string | null;
  mission: string | null;
  vision: string | null;
  aim?: string | null;
  core_values?: string | null;
  service_delivery?: string | null;
  website_url?: string | null;
  youtube_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  twitter_url?: string | null;
  tiktok_url?: string | null;
  linkedin_url?: string | null;
  banner_url: string | null;
  logo_url: string | null;
  is_open: boolean;
  auto_close?: boolean | null;
  opening_hours?: unknown;
  is_pickup_only: boolean;
  delivery_time: string | null;
  whatsapp_number: string | null;
  avg_rating: number | null;
  total_reviews: number | null;
  receipt_template?: string | null;
  receipt_header?: string | null;
  receipt_footer?: string | null;
  receipt_customization?: Record<string, unknown> | null;
  meta_title?: string | null;
  meta_description?: string | null;
  privacy_policy?: string | null;
  terms_of_service?: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  shop_id: string;
  name: string;
  price: number;
  cost: number | null;
  stock: number | null;
  low_stock_threshold: number | null;
  barcode: string | null;
  description: string | null;
  image: string | null;
  category: string | null;
  type: "product" | "service";
  duration?: string | null;
  is_available: boolean;
  is_popular: boolean;
  availability?: "available" | "on_order" | null;
  video_url?: string | null;
  icon?: string | null;
};

export type CartItem = {
  productId: string;
  shopId: string;
  shopName: string;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
  type?: "product" | "service";
  availability?: "available" | "on_order" | null;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "ready_for_collection"
  | "completed"
  | "cancelled"
  | "refunded";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "review_required";
