export interface User {
  email_notifications_enabled: boolean;
  email_notifications_available: boolean;
  id: number;
  email: string;
  date_joined: string;
}
export interface Product {
  id: number;
  url: string;
  store: string;
  title: string;
  image_url: string;
  current_price: string | null;
  currency: string;
  availability: string;
  offer_label: string;
  status: "pending" | "ok" | "error";
  last_checked_at: string | null;
  last_attempted_at: string | null;
  next_check_at: string;
  last_error: string;
}
export interface Watch {
  id: number;
  product: Product;
  target_price: string | null;
  alerts_enabled: boolean;
  created_at: string;
}
export interface PriceAlert {
  id: number;
  watch: number;
  product: Product;
  previous_price: string;
  price: string;
  currency: string;
  created_at: string;
  read_at: string | null;
}
export interface Observation {
  id: number;
  price: string | null;
  currency: string;
  availability: string;
  offer_label: string;
  observed_at: string;
}
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
