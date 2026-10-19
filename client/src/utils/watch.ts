import { Watch } from "../types/models";

export const productTitle = (watch: Watch) =>
  watch.product.title || "Ürün bilgileri hazırlanıyor";
export const targetReached = (watch: Watch) =>
  watch.target_price !== null &&
  watch.product.current_price !== null &&
  Number(watch.product.current_price) <= Number(watch.target_price) &&
  ["in_stock", "unknown"].includes(watch.product.availability);
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Bir sorun oluştu. Lütfen tekrar dene.";
