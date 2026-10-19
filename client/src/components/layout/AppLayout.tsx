import { useState } from "react";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import {
  Avatar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Button,
  IconButton,
  Typography,
} from "@mui/material";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import NotificationsNoneRounded from "@mui/icons-material/NotificationsNoneRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import Brand from "../common/Brand";
import { useAuth } from "../../hooks/useAuth";
import { useFeedback } from "../../hooks/useFeedback";
import { useWatchlist } from "../../hooks/useWatchlist";
import { errorMessage } from "../../utils/watch";

const items = [
  { path: "/watchlist", label: "Takip listem", icon: <DashboardOutlined /> },
  {
    path: "/alerts",
    label: "Fiyat bildirimleri",
    icon: <NotificationsNoneRounded />,
  },
  { path: "/settings", label: "Ayarlar", icon: <TuneRounded /> },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { watches, alerts } = useWatchlist();
  const notify = useFeedback();
  const { pathname } = useLocation();
  const [busy, setBusy] = useState(false);
  const unread = alerts.filter((a) => !a.read_at).length;
  const current =
    items.find((item) => pathname.startsWith(item.path)) || items[0];
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
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Brand />
        <Typography variant="overline" color="text.secondary">
          SENİN İÇİN FİYATLARI TAKİP EDER
        </Typography>
        <nav className="sidebar__nav" aria-label="Ana menü">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? "is-active" : ""}`
              }
            >
              {item.icon}
              <span>{item.label}</span>
              {item.path === "/watchlist" && (
                <span className="nav-count">{watches.length}</span>
              )}
              {item.path === "/alerts" && unread > 0 && (
                <span className="nav-count">{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <section className="sidebar-note">
          <span className="sidebar-note__star">✳</span>
          <Typography variant="h3">
            Biraz sabır.
            <br />
            Daha iyi bir fiyat.
          </Typography>
          <Typography variant="body2">
            Aradığın fırsat, listende seni bekliyor olabilir.
          </Typography>
          <Button
            component={Link}
            to="/watchlist/new"
            endIcon={<ArrowOutwardRounded />}
          >
            Yeni ürün ekle
          </Button>
        </section>
        <div className="sidebar__bottom">
          <Typography variant="caption" color="text.secondary">
            Fiyatları bize bırak, hayatına bak.
          </Typography>
          <div className="user-block">
            <Avatar>{user?.email[0].toLocaleUpperCase("tr-TR")}</Avatar>
            <div>
              <Typography variant="body2" className="text-bold">
                {user?.email.split("@")[0]}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Kişisel alanın
              </Typography>
            </div>
            <IconButton
              onClick={signOut}
              disabled={busy}
              aria-label="Çıkış yap"
            >
              <LogoutRounded fontSize="small" />
            </IconButton>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="breadcrumb">
            <span>Kişisel alanım</span>
            <span>/</span>
            <strong>{current.label}</strong>
          </div>
          <div className="topbar__right">
            <Typography
              variant="body2"
              color="text.secondary"
              className="topbar__date"
            >
              {new Date().toLocaleDateString("tr-TR", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </Typography>
            <IconButton
              component={Link}
              to="/alerts"
              aria-label={`Fiyat bildirimleri, ${unread} okunmamış`}
            >
              <Badge variant="dot" color="primary" invisible={!unread}>
                <NotificationsNoneRounded />
              </Badge>
            </IconButton>
            <IconButton component={Link} to="/settings" aria-label="Hesabın">
              <Avatar className="avatar-small">
                {user?.email[0].toLocaleUpperCase("tr-TR")}
              </Avatar>
            </IconButton>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
          <footer className="main-footer">
            <Typography variant="caption">
              Kaydet. Takip et. İyi fiyata yakala.
            </Typography>
            <Typography variant="body2" className="text-bold">
              bindirim<span className="brand__dot">.</span>
            </Typography>
          </footer>
        </main>
        <BottomNavigation
          className="mobile-nav"
          showLabels
          value={current.path}
        >
          {items.map((item) => (
            <BottomNavigationAction
              key={item.path}
              component={Link}
              to={item.path}
              value={item.path}
              label={item.label}
              icon={
                item.path === "/alerts" ? (
                  <Badge color="primary" badgeContent={unread}>
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )
              }
            />
          ))}
        </BottomNavigation>
      </div>
    </div>
  );
}
