import { useState } from "react";
import { Alert, Button, Chip, Paper, Typography } from "@mui/material";
import NotificationsNoneRounded from "@mui/icons-material/NotificationsNoneRounded";
import TrendingDownRounded from "@mui/icons-material/TrendingDownRounded";
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import { Link } from "react-router-dom";
import { useWatchlist } from "../hooks/useWatchlist";
import { useFeedback } from "../hooks/useFeedback";
import { dateTime, money, storeName } from "../utils/format";
import { errorMessage } from "../utils/watch";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import LoadingState from "../components/common/LoadingState";
import ProductImage from "../components/common/ProductImage";

export default function AlertsPage() {
  const { alerts, loading, error, reload, markRead } = useWatchlist();
  const [busy, setBusy] = useState<number | null>(null);
  const notify = useFeedback();
  const unread = alerts.filter((alert) => !alert.read_at).length;
  const read = async (id: number) => {
    setBusy(id);
    try {
      await markRead(id);
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="GÜZEL HABERLER BURADA"
        title="Bakmaya değer fiyatlar"
        description="Fiyat düşüşleri ve hedef fiyatına ulaşan ürünler tek bir yerde."
        action={<Chip label={`${unread} okunmamış`} variant="outlined" />}
      />
      {error && (
        <Alert
          severity="error"
          action={<Button onClick={reload}>Tekrar dene</Button>}
        >
          {error}
        </Alert>
      )}
      {loading ? (
        <LoadingState label="Bildirimlerin yükleniyor…" />
      ) : !alerts.length ? (
        <EmptyState
          icon={<NotificationsNoneRounded />}
          title="Henüz bir bildirim yok."
          description="Takip ettiğin bir ürünün fiyatı düştüğünde bildirimin burada görünecek. Bildirimler uygulama içinde gösterilir; e-posta ve anlık bildirim henüz kullanılamıyor."
          action={
            <Button variant="outlined" component={Link} to="/watchlist">
              Takip listeme dön
            </Button>
          }
        />
      ) : (
        <div className="alerts-list">
          {alerts.map((alert) => (
            <Paper
              component="article"
              variant="outlined"
              key={alert.id}
              className={`alert-card ${!alert.read_at ? "alert-card--unread" : ""}`}
            >
              <ProductImage
                src={alert.product.image_url}
                title={alert.product.title}
              />
              <div className="alert-card__body">
                <div className="alert-card__eyebrow">
                  <TrendingDownRounded fontSize="small" />
                  <Typography variant="overline">
                    ÖNCEKİNDEN DAHA UYGUN
                  </Typography>
                  {!alert.read_at && <span className="status-dot" />}
                </div>
                <Typography variant="h3">
                  <Link to={`/watchlist/${alert.watch}`}>
                    {alert.product.title || "Kaydettiğin ürün"}
                  </Link>
                </Typography>
                <div className="alert-card__prices">
                  <Typography variant="h2">
                    {money(alert.price, alert.currency)}
                  </Typography>
                  <Typography
                    component="del"
                    variant="body2"
                    color="text.secondary"
                  >
                    {money(alert.previous_price, alert.currency)}
                  </Typography>
                  <Chip
                    size="small"
                    label={`${money(Number(alert.previous_price) - Number(alert.price), alert.currency)} daha düşük`}
                  />
                </div>
                <Typography variant="caption" color="text.secondary">
                  {dateTime(alert.created_at)} ·{" "}
                  {storeName(alert.product.store)}
                </Typography>
              </div>
              <div className="alert-card__actions">
                <Button
                  variant="outlined"
                  href={alert.product.url}
                  target="_blank"
                  rel="noreferrer"
                  endIcon={<ArrowOutwardRounded />}
                >
                  Mağazaya git
                </Button>
                {!alert.read_at ? (
                  <Button
                    size="small"
                    onClick={() => read(alert.id)}
                    disabled={busy === alert.id}
                  >
                    {busy === alert.id ? "Güncelleniyor…" : "Okundu işaretle"}
                  </Button>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    <CheckRounded fontSize="small" /> Okundu
                  </Typography>
                )}
              </div>
            </Paper>
          ))}
        </div>
      )}
    </>
  );
}
