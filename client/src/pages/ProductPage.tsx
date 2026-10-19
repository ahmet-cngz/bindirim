import { useState } from "react";
import type { FormEvent } from "react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  InputAdornment,
  Paper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import TrackChangesRounded from "@mui/icons-material/TrackChangesRounded";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useWatchlist } from "../hooks/useWatchlist";
import { usePriceHistory } from "../hooks/usePriceHistory";
import { useAuth } from "../hooks/useAuth";
import { useFeedback } from "../hooks/useFeedback";
import { request } from "../utils/api";
import {
  dateTime,
  money,
  storeName,
  timeAgo,
  offerLabel,
} from "../utils/format";
import { errorMessage, productTitle } from "../utils/watch";
import { Watch } from "../types/models";
import { translateServerMessage } from "../utils/serverMessages";
import ProductImage from "../components/common/ProductImage";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import LoadingState from "../components/common/LoadingState";
import PriceHistory from "../components/products/PriceHistory";

function ProductDetails({ watch }: { watch: Watch }) {
  const { token } = useAuth();
  const { updateWatch, removeWatch } = useWatchlist();
  const {
    observations,
    loading,
    error: historyError,
    retry,
  } = usePriceHistory(watch.id, watch.product.last_checked_at);
  const notify = useFeedback();
  const navigate = useNavigate();
  const [target, setTarget] = useState(watch.target_price || "");
  const [enabled, setEnabled] = useState(watch.alerts_enabled);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const product = watch.product;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("save");
    setError("");
    try {
      await updateWatch(watch.id, target, enabled);
      notify("Fiyat tercihlerin kaydedildi.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  };
  const refresh = async () => {
    setBusy("refresh");
    setError("");
    try {
      await request(`watches/${watch.id}/refresh/`, token, {
        method: "POST",
        data: {},
      });
      notify(
        "Fiyat kontrolü istendi. Takip görevi çalıştığında ürün bilgileri güncellenecek.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  };
  const remove = async () => {
    setBusy("remove");
    setError("");
    try {
      await removeWatch(watch.id);
      notify("Ürün takip listenden kaldırıldı.");
      navigate("/watchlist");
    } catch (err) {
      setError(errorMessage(err));
      setConfirmRemove(false);
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <Button
        component={Link}
        to="/watchlist"
        startIcon={<ArrowBackRounded />}
        className="back-link"
      >
        Takip listeme dön
      </Button>
      <PageHeader
        eyebrow={storeName(product.store).toLocaleUpperCase("tr-TR")}
        title={productTitle(watch)}
        description={
          offerLabel(product.offer_label) ||
          "Ürün bilgileri ilk kontrolden sonra görünür."
        }
        action={
          <Button
            variant="outlined"
            href={product.url}
            target="_blank"
            rel="noreferrer"
            endIcon={<ArrowOutwardRounded />}
          >
            Mağazada gör
          </Button>
        }
      />
      {product.status === "error" && (
        <Alert severity="warning">
          {translateServerMessage(product.last_error) ||
            "Son fiyat kontrolü başarısız oldu. Yeniden deneyeceğiz."}{" "}
          {product.current_price && "Gösterilen fiyat son kaydedilen fiyattır."}
        </Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      <div className="product-detail-grid">
        <div className="product-detail-main">
          <Paper variant="outlined" className="product-overview">
            <ProductImage src={product.image_url} title={product.title} />
            <div>
              <Chip
                size="small"
                label={
                  product.status === "pending"
                    ? "İlk kontrol bekleniyor"
                    : ["out_of_stock", "unavailable"].includes(
                          product.availability,
                        )
                      ? "Şu anda mevcut değil"
                      : product.availability === "in_stock"
                        ? "Stokta"
                        : "Stok bilgisi bilinmiyor"
                }
              />
              <Typography variant="body2" color="text.secondary">
                Son kaydedilen fiyat
              </Typography>
              <Typography variant="h1">
                {money(product.current_price, product.currency)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {timeAgo(product.last_checked_at)}
              </Typography>
              <Button
                onClick={refresh}
                startIcon={<RefreshRounded />}
                disabled={!!busy}
              >
                {busy === "refresh" ? "İsteniyor…" : "Fiyat kontrolü iste"}
              </Button>
            </div>
          </Paper>
          <Paper variant="outlined" className="detail-panel">
            <div className="section-heading">
              <Typography variant="h3">Fiyat geçmişi</Typography>
              <Typography variant="overline" color="text.secondary">
                KAYDEDİLEN FİYATLAR
              </Typography>
            </div>
            {loading ? (
              <LoadingState label="Fiyat geçmişi yükleniyor…" />
            ) : historyError ? (
              <Alert
                severity="error"
                action={<Button onClick={retry}>Tekrar dene</Button>}
              >
                {historyError}
              </Alert>
            ) : (
              <PriceHistory observations={observations} />
            )}
          </Paper>
        </div>
        <aside className="detail-panel preference-panel">
          <div className="section-heading">
            <Typography variant="h3">Senin için ideal fiyat</Typography>
            <TrackChangesRounded color="primary" />
          </div>
          <Typography variant="body2" color="text.secondary">
            Hedef fiyat belirle veya her fiyat düşüşünü takip et.
          </Typography>
          <form onSubmit={save} className="form-stack">
            <TextField
              label="Hedef fiyat (isteğe bağlı)"
              type="number"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              disabled={!!busy}
              fullWidth
              placeholder="Her fiyat düşüşü"
              slotProps={{
                htmlInput: { min: 0.01, max: 9999999999.99, step: 0.01 },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">₺</InputAdornment>
                  ),
                },
              }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  disabled={!!busy}
                />
              }
              label="Fiyat düşüşü bildirimleri"
            />
            <Typography variant="caption" color="text.secondary">
              Bildirimler uygulama içinde görünür. Fiyat, hedefinin üzerindeyken
              hedefine veya altına düştüğünde bildirim oluşturulur.
            </Typography>
            <Button type="submit" variant="contained" disabled={!!busy}>
              {busy === "save" ? "Kaydediliyor…" : "Tercihleri kaydet"}
            </Button>
          </form>
          <Divider />
          <Typography variant="caption" color="text.secondary">
            {product.last_checked_at
              ? `Son başarılı kontrol: ${dateTime(product.last_checked_at)}`
              : "İlk başarılı fiyat kontrolü bekleniyor."}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Gösterilen fiyatlara üyelik fırsatları, sepet indirimleri ve kargo
            dahil değildir.
          </Typography>
          <Button
            startIcon={<DeleteOutlineRounded />}
            onClick={() => setConfirmRemove(true)}
            disabled={!!busy}
          >
            Bu ürünü takip etmeyi bırak
          </Button>
        </aside>
      </div>
      <Dialog
        open={confirmRemove}
        onClose={() => {
          if (!busy) setConfirmRemove(false);
        }}
        aria-labelledby="remove-title"
      >
        <DialogTitle id="remove-title">
          Ürünü takipten çıkaralım mı?
        </DialogTitle>
        <DialogContent>
          <Typography>
            Ürün ve ona ait bildirimler kişisel takip listenden kaldırılır.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRemove(false)} disabled={!!busy}>
            Takip etmeye devam et
          </Button>
          <Button variant="contained" onClick={remove} disabled={!!busy}>
            {busy === "remove" ? "Kaldırılıyor…" : "Takibi bırak"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default function ProductPage() {
  const { watchId } = useParams();
  const { watches, loading, error, reload } = useWatchlist();
  if (loading) return <LoadingState />;
  const watch = watches.find((item) => item.id === Number(watchId));
  if (!watch)
    return error ? (
      <Alert
        severity="error"
        action={<Button onClick={reload}>Tekrar dene</Button>}
      >
        {error}
      </Alert>
    ) : (
      <EmptyState
        icon={<TrackChangesRounded />}
        title="Bu ürün takip listende yok."
        description="Ürün kaldırılmış veya başka bir hesaba ait olabilir."
        action={
          <Button component={Link} to="/watchlist">
            Takip listesine dön
          </Button>
        }
      />
    );
  return <ProductDetails key={watch.id} watch={watch} />;
}
