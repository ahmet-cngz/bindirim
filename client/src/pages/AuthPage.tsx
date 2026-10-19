import { useState } from "react";
import type { FormEvent } from "react";
import {
  Alert,
  Button,
  IconButton,
  InputAdornment,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";
import FavoriteBorderRounded from "@mui/icons-material/FavoriteBorderRounded";
import TrendingDownRounded from "@mui/icons-material/TrendingDownRounded";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import Brand from "../components/common/Brand";
import LoadingState from "../components/common/LoadingState";
import { useAuth } from "../hooks/useAuth";
import { errorMessage } from "../utils/watch";

export default function AuthPage({ signup = false }: { signup?: boolean }) {
  const { authenticate, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const destination =
    typeof location.state?.from === "string" &&
    location.state.from.startsWith("/") &&
    !location.state.from.startsWith("//")
      ? location.state.from
      : "/watchlist";
  if (loading) return <LoadingState />;
  if (user) return <Navigate to={destination} replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authenticate(email, password, signup);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="auth-story__copy">
          <Typography variant="overline">
            SEN BEĞEN, BİZ FİYATINI TAKİP EDELİM
          </Typography>
          <h1>
            Beğendiğin ürünler.
            <br />
            Daha iyi <em>fiyatlar.</em>
          </h1>
          <Typography>
            Beğendiğin ürünleri kaydet. Fiyatlarını senin için biz takip edelim.
          </Typography>
        </div>
        <div className="auth-art" aria-hidden="true">
          <div className="auth-art__orbit" />
          <div className="auth-art__tag">
            <span className="tag-hole" />
            <span>GÜZEL FİYATLAR</span>
            <strong>
              sabırla
              <br />
              gelir.<span>↘</span>
            </strong>
            <span className="tag-footer">DAHA AZ ÖDE. KEYFİNİ ÇIKAR.</span>
          </div>
          <div className="auth-art__note auth-art__note--top">
            <FavoriteBorderRounded />
            <div>
              <strong>Beğendin mi?</strong>
              <span>Listene ekle.</span>
            </div>
          </div>
          <div className="auth-art__note auth-art__note--bottom">
            <TrendingDownRounded />
            <div>
              <strong>Biraz sabır.</strong>
              <span>Daha iyi bir fiyat.</span>
            </div>
            <span>✧</span>
          </div>
          <span className="auth-art__star">✳</span>
        </div>
        <Typography variant="caption" className="auth-story__footer">
          Alışverişin daha akıllı yolu. <span>BEĞENDİĞİN HER ÜRÜN İÇİN ↗</span>
        </Typography>
      </section>
      <section className="auth-form-side">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form">
          <Typography variant="overline" color="text.secondary">
            İYİ FİYATLARA İLK ADIM
          </Typography>
          <Typography variant="h1">
            {signup ? "Beğendiklerine yer aç." : "Tekrar hoş geldin."}
          </Typography>
          <Typography color="text.secondary">
            {signup
              ? "Hesabını oluştur, beğendiğin ürünlerin fiyatını takip etmeye başla."
              : "Takip listendeki ürünler seni bekliyor."}
          </Typography>
          <Tabs
            value={signup ? 1 : 0}
            variant="fullWidth"
            aria-label="Hesap işlemi"
          >
            <Tab
              label="Giriş yap"
              component={Link}
              to="/login"
              state={location.state}
              disabled={busy}
            />
            <Tab
              label="Hesap oluştur"
              component={Link}
              to="/signup"
              state={location.state}
              disabled={busy}
            />
          </Tabs>
          <form onSubmit={submit} className="form-stack">
            <TextField
              fullWidth
              label="E-posta adresi"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={busy}
              slotProps={{ htmlInput: { maxLength: 254 } }}
            />
            <TextField
              fullWidth
              label="Şifre"
              type={visible ? "text" : "password"}
              autoComplete={signup ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={busy}
              helperText={
                signup
                  ? "En az 8 karakter kullan. Yaygın şifrelerden kaçın."
                  : undefined
              }
              slotProps={{
                htmlInput: {
                  minLength: signup ? 8 : undefined,
                  maxLength: 128,
                },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setVisible(!visible)}
                        aria-label={
                          visible ? "Şifreyi gizle" : "Şifreyi göster"
                        }
                      >
                        {visible ? (
                          <VisibilityOffOutlined />
                        ) : (
                          <VisibilityOutlined />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={busy}
              endIcon={<ArrowOutwardRounded />}
            >
              {busy
                ? "Biraz bekle…"
                : signup
                  ? "Hesabımı oluştur"
                  : "Takip listeme git"}
            </Button>
          </form>
          <div className="auth-assurance">
            <ShieldOutlined fontSize="small" />
            <Typography variant="caption" color="text.secondary">
              Takip listen sana özel. Ürünlerini yalnızca sen görürsün.
            </Typography>
          </div>
        </div>
        <footer className="auth-form-side__footer">
          <Typography variant="caption">
            Kaydet. Takip et. İyi fiyata yakala.
          </Typography>
          <Typography variant="caption">
            © {new Date().getFullYear()} Bindirim
          </Typography>
        </footer>
      </section>
    </main>
  );
}
