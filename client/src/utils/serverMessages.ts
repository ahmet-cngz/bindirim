// Keep API identifiers unchanged; localize only messages shown to the user.
const messages: Record<string, string> = {
  "Invalid email or password.": "E-posta adresi veya şifre hatalı.",
  "Incorrect password.": "Şifre hatalı.",
  "Invalid token.": "Oturumun geçersiz. Lütfen yeniden giriş yap.",
  "Authentication credentials were not provided.":
    "Devam etmek için giriş yapmalısın.",
  "You do not have permission to perform this action.":
    "Bu işlem için yetkin bulunmuyor.",
  "Not found.": "Kayıt bulunamadı.",
  "An account with this email already exists.":
    "Bu e-posta adresiyle kayıtlı bir hesap zaten var.",
  "You already track this product.": "Bu ürün zaten takip listende.",
  "This field is required.": "Bu alan zorunludur.",
  "This field may not be blank.": "Bu alan boş bırakılamaz.",
  "This field may not be null.": "Bu alan boş bırakılamaz.",
  "Enter a valid email address.": "Geçerli bir e-posta adresi gir.",
  "Enter a valid URL.": "Geçerli bir bağlantı gir.",
  "A valid number is required.": "Geçerli bir sayı gir.",
  "Must be positive.": "Değer sıfırdan büyük olmalı.",
  "This password is too common.":
    "Bu şifre çok yaygın. Daha güçlü bir şifre seç.",
  "This password is entirely numeric.": "Şifren yalnızca rakamlardan oluşamaz.",
  "Use an HTTPS product URL from Trendyol or Hepsiburada.":
    "Trendyol veya Hepsiburada’dan HTTPS ile başlayan bir ürün bağlantısı kullan.",
  "This URL is not a supported product page.":
    "Bu bağlantı desteklenen bir ürün sayfasına ait değil.",
  "Product URL is too long.": "Ürün bağlantısı çok uzun.",
  "Seller/variant URL parameters are not supported yet; use the base product URL.":
    "Satıcı veya ürün seçeneği parametreleri henüz desteklenmiyor. Ana ürün bağlantısını kullan.",
  "Remove this watch and create a new one to change its product.":
    "Ürünü değiştirmek için bu takibi kaldırıp yeni bir ürün ekle.",
  "This product was checked recently. Try again after 15 minutes.":
    "Bu ürün kısa süre önce kontrol edildi. 15 dakika sonra tekrar deneyebilirsin.",
  "Store DNS lookup failed.":
    "Mağazanın adresi çözümlenemedi. Yeniden denenecek.",
  "Store resolved to a non-public address.":
    "Mağazanın adresine güvenli şekilde erişilemiyor.",
  "Store redirected to a different retailer.":
    "Mağaza başka bir alışveriş sitesine yönlendirdi.",
  "Store request timed out.": "Mağazadan yanıt beklenirken süre doldu.",
  "Store returned an invalid redirect.":
    "Mağaza geçersiz bir yönlendirme döndürdü.",
  "Store did not return an HTML product page.":
    "Mağazadan geçerli bir ürün sayfası alınamadı.",
  "Product page exceeded the size limit.": "Ürün sayfası boyut sınırını aştı.",
  "Could not fetch the store page; it may be unavailable or blocking automated access.":
    "Mağaza sayfasına erişilemedi. Site geçici olarak kullanılamıyor veya otomatik erişimi engelliyor olabilir.",
  "Store returned too many redirects.":
    "Mağaza çok fazla yönlendirme döndürdü.",
  "Store returned an invalid price.": "Mağazadan geçerli bir fiyat alınamadı.",
  "Store returned an ambiguous price.":
    "Mağazadaki fiyat kesin olarak belirlenemedi.",
  "Store returned an invalid or ambiguous price.":
    "Mağazadan güvenilir bir fiyat alınamadı.",
  "Page contains multiple products; variant selection is not supported yet.":
    "Sayfada birden fazla ürün var. Ürün seçeneği belirleme henüz desteklenmiyor.",
  "Page contains multiple offers; seller/variant selection is not supported yet.":
    "Sayfada birden fazla teklif var. Satıcı veya ürün seçeneği belirleme henüz desteklenmiyor.",
  "Page does not expose a single product offer.":
    "Sayfada tek bir ürün teklifi belirlenemedi.",
  "A reliable TRY price was not found on this page.":
    "Bu sayfada güvenilir bir TL fiyatı bulunamadı.",
  "Trendyol page data changed or is incomplete; tracker needs an update.":
    "Trendyol sayfasının yapısı değişmiş veya bilgileri eksik. Takip bileşeninin güncellenmesi gerekiyor.",
  "Unexpected price check failure. The tracker will retry.":
    "Fiyat kontrolünde beklenmeyen bir sorun oluştu. Yeniden denenecek.",
  "Public page price": "Ürün sayfasındaki fiyat",
};

export function translateServerMessage(value: string): string {
  if (messages[value]) return messages[value];
  const http = value.match(/^Store returned HTTP (\d+)\.$/);
  if (http) return `Mağazaya erişilemedi (HTTP ${http[1]}). Yeniden denenecek.`;
  const throttle = value.match(
    /^Request was throttled\. Expected available in (\d+) seconds?\.$/,
  );
  if (throttle)
    return `Çok fazla istek gönderildi. ${throttle[1]} saniye sonra tekrar dene.`;
  const minimum = value.match(
    /^This password is too short\. It must contain at least (\d+) characters\.$/,
  );
  if (minimum) return `Şifren en az ${minimum[1]} karakter içermeli.`;
  if (/^The password is too similar to the /.test(value))
    return "Şifren kişisel bilgilerine çok benziyor.";
  const positive = value.match(
    /^Ensure this value is greater than or equal to (.+)\.$/,
  );
  if (positive) return `Değer en az ${positive[1]} olmalı.`;
  const length = value.match(
    /^Ensure this field has no more than (\d+) characters\.$/,
  );
  if (length) return `Bu alan en fazla ${length[1]} karakter içerebilir.`;
  return value;
}

export function apiFieldLabel(key: string): string {
  return (
    (
      {
        url: "Ürün bağlantısı",
        email: "E-posta",
        password: "Şifre",
        target_price: "Hedef fiyat",
        alerts_enabled: "Bildirimler",
      } as Record<string, string>
    )[key] || key.replace(/_/g, " ")
  );
}
