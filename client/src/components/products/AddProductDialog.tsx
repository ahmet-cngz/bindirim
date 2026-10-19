import { useState } from "react";
import type { FormEvent } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { useNavigate } from "react-router-dom";
import { useWatchlist } from "../../hooks/useWatchlist";
import { useFeedback } from "../../hooks/useFeedback";
import { errorMessage } from "../../utils/watch";

export default function AddProductDialog() {
  const navigate = useNavigate();
  const { addWatch } = useWatchlist();
  const notify = useFeedback();
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = () => {
    if (!busy) navigate("/watchlist");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await addWatch(url, target);
      notify("Ürün kaydedildi. Fiyatını takip ediyoruz.");
      navigate("/watchlist");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={close} aria-labelledby="add-product-title">
      <form onSubmit={submit}>
        <DialogTitle id="add-product-title" className="dialog-title">
          <span>Beğendiğin bir ürün mü var?</span>
          <IconButton
            onClick={close}
            disabled={busy}
            aria-label="Pencereyi kapat"
          >
            <CloseRounded />
          </IconButton>
        </DialogTitle>
        <DialogContent className="form-stack">
          <Typography color="text.secondary">
            Bağlantıyı ekle, gerisini bize bırak.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Ürün bağlantısı"
            type="url"
            placeholder="https://www.trendyol.com/…"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={busy}
            slotProps={{ htmlInput: { maxLength: 2048 } }}
            helperText="Trendyol ve Hepsiburada destekleniyor. Beden veya satıcı parametresi içermeyen ana ürün bağlantısını kullan."
          />
          <TextField
            fullWidth
            label="İstediğin fiyat (isteğe bağlı)"
            type="number"
            placeholder="Her fiyat düşüşü"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            disabled={busy}
            slotProps={{
              htmlInput: { min: 0.01, max: 9999999999.99, step: 0.01 },
              input: {
                startAdornment: (
                  <InputAdornment position="start">₺</InputAdornment>
                ),
              },
            }}
            helperText="Her fiyat düşüşünde bildirim almak için boş bırak."
          />
          <Alert severity="info">
            Ürün hemen listene eklenir. Ürün bilgileri ve fiyatı bir sonraki
            kontrolde görünür.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={busy}>
            Vazgeç
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={<AddRounded />}
            disabled={busy}
          >
            {busy ? "Kaydediliyor…" : "Takip listeme ekle"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
