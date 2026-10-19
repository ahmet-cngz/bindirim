import { useState } from "react";
import type { FormEvent } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import { useAuth } from "../hooks/useAuth";
import { useFeedback } from "../hooks/useFeedback";
import { request } from "../utils/api";
import { errorMessage } from "../utils/watch";
import PageHeader from "../components/common/PageHeader";

import NotificationSettings from "../components/settings/NotificationSettings/NotificationSettings";

export default function SettingsPage() {
  const { user, token, logout, clearSession, updateNotificationPreferences } = useAuth();
  const notify = useFeedback();
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signOut = async () => {
    setBusy(true);
    try {
      await logout();
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("auth/me/", token, {
        method: "DELETE",
        data: { password },
      });
      clearSession();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="HER ŞEY SENİN KONTROLÜNDE"
        title="Sana özel alan"
        description="Hesap bilgilerin ve fiyat takibi hakkında bilmen gerekenler."
      />
      <div className="settings-grid">
        <Paper variant="outlined" className="settings-panel">
          <span className="panel-icon">
            <ShieldOutlined />
          </span>
          <Typography variant="h2">Hesabın</Typography>
          <Typography variant="overline" color="text.secondary">
            E-POSTA ADRESİ
          </Typography>
          <Typography>{user?.email}</Typography>
          <Typography variant="body2" color="text.secondary">
            Katılım tarihi:{" "}
            {user &&
              new Date(user.date_joined).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
          </Typography>
          <Button
            variant="outlined"
            onClick={signOut}
            startIcon={<LogoutRounded />}
            disabled={busy}
          >
            Çıkış yap
          </Button>
        </Paper>
        {user && <NotificationSettings user={user} onSave={updateNotificationPreferences} />}
        <Paper variant="outlined" className="settings-panel">
          <span className="panel-icon">
            <ScheduleRounded />
          </span>
          <Typography variant="h2">Fiyat takibi nasıl çalışır?</Typography>
          <Typography variant="body2" color="text.secondary">
            Kaydedilen ürünler düzenli olarak kontrol edilir. Yerel takip
            görevi, Mac’in açık ve kullanıcı oturumun aktifken yaklaşık 15
            dakikada bir çalışır.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Fiyatlar ürün sayfasında herkese gösterilen fiyatlardır. Üyelik
            fırsatları, kuponlar, sepet indirimleri ve kargo, ödeme tutarını
            değiştirebilir.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Fiyat düşüşü bildirimleri uygulama içinde görünür. İstersen e-posta
            bildirimlerini de açabilirsin. Anlık bildirim henüz kullanılamıyor.
          </Typography>
        </Paper>
        <Paper
          variant="outlined"
          className="settings-panel settings-panel--delete"
        >
          <Typography variant="h3">Hesabı sil</Typography>
          <Typography variant="body2" color="text.secondary">
            Bu işlem hesabını, takip listeni ve bildirimlerini kalıcı olarak
            siler. Herkese açık ürün fiyat kayıtları korunur.
          </Typography>
          <Button
            startIcon={<DeleteOutlineRounded />}
            onClick={() => setDeleting(true)}
          >
            Hesabımı sil
          </Button>
        </Paper>
      </div>
      <Dialog
        open={deleting}
        onClose={() => {
          if (!busy) setDeleting(false);
        }}
        aria-labelledby="delete-account-title"
      >
        <form onSubmit={remove}>
          <DialogTitle id="delete-account-title">
            Hesabını silmek istiyor musun?
          </DialogTitle>
          <DialogContent className="form-stack">
            <Typography>
              Hesabın ve kişisel takip listen kalıcı olarak silinecek.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              type="password"
              label="Şifreni doğrula"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={busy}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleting(false)} disabled={busy}>
              Vazgeç
            </Button>
            <Button variant="contained" type="submit" disabled={busy}>
              {busy ? "Siliniyor…" : "Hesabı kalıcı olarak sil"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
