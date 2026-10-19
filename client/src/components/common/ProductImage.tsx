import { useEffect, useState } from "react";
import ShoppingBagOutlined from "@mui/icons-material/ShoppingBagOutlined";

export default function ProductImage({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div className="product-image">
      {src && !failed ? (
        <img
          src={src}
          alt={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="product-image__placeholder">
          <ShoppingBagOutlined fontSize="large" />
          <span>
            {title ? "Görsel yüklenemedi" : "Ürün bilgileri alınıyor"}
          </span>
        </div>
      )}
    </div>
  );
}
