import { translateServerMessage } from "./serverMessages";

export const offerLabel = (value: string) => translateServerMessage(value);

export const money = (value: string | number | null, currency = "TRY") =>
  value === null
    ? "Fiyat bekleniyor"
    : new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(Number(value));

export const storeName = (store: string) =>
  ({ trendyol: "Trendyol", hepsiburada: "Hepsiburada" })[store] || store;
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export function timeAgo(value: string | null): string {
  if (!value) return "İlk kontrol bekleniyor";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  if (minutes < 1) return "Az önce kontrol edildi";
  if (minutes < 60) return `${minutes} dk önce kontrol edildi`;
  if (minutes < 1440)
    return `${Math.floor(minutes / 60)} sa önce kontrol edildi`;
  return `${Math.floor(minutes / 1440)} gün önce kontrol edildi`;
}
