import {
  Card,
  CardActionArea,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import TrackChangesRounded from "@mui/icons-material/TrackChangesRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import { Link } from "react-router-dom";
import { PriceAlert, Watch } from "../../types/models";
import { money, storeName, timeAgo, offerLabel } from "../../utils/format";
import { productTitle, targetReached } from "../../utils/watch";
import ProductImage from "../common/ProductImage";

export default function ProductCard({
  watch,
  alert,
}: {
  watch: Watch;
  alert?: PriceAlert;
}) {
  const product = watch.product;
  const drop =
    alert &&
    product.current_price === alert.price &&
    Number(alert.previous_price) > Number(alert.price)
      ? Math.round(
          (1 - Number(alert.price) / Number(alert.previous_price)) * 100,
        )
      : 0;
  const status =
    product.status === "error"
      ? "Kontrol başarısız · yeniden denenecek"
      : product.status === "pending"
        ? "İlk kontrol bekleniyor"
        : ["out_of_stock", "unavailable"].includes(product.availability)
          ? "Şu anda mevcut değil"
          : timeAgo(product.last_checked_at);
  return (
    <Card variant="outlined" className="product-card">
      <CardActionArea
        component={Link}
        to={`/watchlist/${watch.id}`}
        className="product-card__image-link"
        aria-label={`${productTitle(watch)} ürününü görüntüle`}
      >
        <ProductImage src={product.image_url} title={product.title} />
        {drop > 0 && (
          <Chip
            className="product-card__badge"
            size="small"
            label={`%${drop} daha düşük`}
            color="primary"
          />
        )}
        {targetReached(watch) && (
          <Chip
            className="product-card__target"
            size="small"
            label="Hedef fiyata ulaştı"
          />
        )}
        <span className="product-card__arrow">
          <ArrowOutwardRounded fontSize="small" />
        </span>
      </CardActionArea>
      <div className="product-card__body">
        <div className="product-card__store">
          <Typography variant="overline">{storeName(product.store)}</Typography>
          {!watch.alerts_enabled && (
            <Typography variant="caption" color="text.secondary">
              Bildirimler kapalı
            </Typography>
          )}
        </div>
        <Link to={`/watchlist/${watch.id}`} className="product-card__title">
          <Typography variant="h3">{productTitle(watch)}</Typography>
        </Link>
        <Typography
          variant="body2"
          color="text.secondary"
          className="product-card__offer"
        >
          {offerLabel(product.offer_label) ||
            "Bilgiler ilk kontrolden sonra görünür"}
        </Typography>
        <div className="product-card__price">
          <Typography variant="h2">
            {money(product.current_price, product.currency)}
          </Typography>
          {drop > 0 && (
            <Typography component="del" color="text.secondary" variant="body2">
              {money(alert!.previous_price, product.currency)}
            </Typography>
          )}
        </div>
        <div className="product-card__target-line">
          <TrackChangesRounded fontSize="small" />
          <Typography variant="caption">
            {watch.target_price
              ? `Hedef: ${money(watch.target_price, product.currency)}`
              : "Her fiyat düşüşü takip ediliyor"}
          </Typography>
        </div>
        <footer className="product-card__footer">
          <span
            className={`status-dot ${product.status !== "ok" ? "status-dot--muted" : ""}`}
          />
          <Typography variant="caption" color="text.secondary">
            {status}
          </Typography>
          <Tooltip title="Ürünü yönet">
            <IconButton
              size="small"
              component={Link}
              to={`/watchlist/${watch.id}`}
              aria-label={`${productTitle(watch)} ürününü yönet`}
            >
              <TuneRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        </footer>
      </div>
    </Card>
  );
}
