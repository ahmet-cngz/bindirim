import {
  Alert,
  Button,
  InputAdornment,
  MenuItem,
  Paper,
  Skeleton,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import ShoppingBagOutlined from "@mui/icons-material/ShoppingBagOutlined";
import TrendingDownRounded from "@mui/icons-material/TrendingDownRounded";
import TrackChangesRounded from "@mui/icons-material/TrackChangesRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import GridViewRounded from "@mui/icons-material/GridViewRounded";
import ViewListRounded from "@mui/icons-material/ViewListRounded";
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { Link, Outlet, useSearchParams } from "react-router-dom";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import ProductCard from "../components/products/ProductCard";
import { useWatchlist } from "../hooks/useWatchlist";
import { productTitle, targetReached } from "../utils/watch";

export default function WatchlistPage() {
  const { watches, alerts, loading, refreshing, error, reload } =
    useWatchlist();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const filter = ["all", "targets", "issues"].includes(
    params.get("filter") || "",
  )
    ? params.get("filter")!
    : "all";
  const store = ["all", "trendyol", "hepsiburada"].includes(
    params.get("store") || "",
  )
    ? params.get("store")!
    : "all";
  const sort = ["newest", "price", "name"].includes(params.get("sort") || "")
    ? params.get("sort")!
    : "newest";
  const layout = params.get("layout") === "list" ? "list" : "grid";
  const change = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        value ? next.set(key, value) : next.delete(key);
        return next;
      },
      { replace: true },
    );
  const unread = alerts.filter((alert) => !alert.read_at).length;
  const matched = watches.filter(targetReached).length;
  const filtered = watches
    .filter(
      (watch) =>
        (store === "all" || watch.product.store === store) &&
        (filter === "all" ||
          (filter === "targets" && targetReached(watch)) ||
          (filter === "issues" && watch.product.status !== "ok")) &&
        `${watch.product.title} ${watch.product.offer_label} ${watch.product.store} ${watch.product.url}`
          .toLocaleLowerCase("tr-TR")
          .includes(query.toLocaleLowerCase("tr-TR")),
    )
    .sort((a, b) =>
      sort === "price"
        ? (a.product.current_price === null
            ? Infinity
            : Number(a.product.current_price)) -
          (b.product.current_price === null
            ? Infinity
            : Number(b.product.current_price))
        : sort === "name"
          ? productTitle(a).localeCompare(productTitle(b), "tr-TR")
          : new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  return (
    <>
      <PageHeader
        eyebrow="GÜZEL FİYATLAR BEKLEMEYE DEĞER"
        title="İyi fiyatlar gözümüzden kaçmaz"
        description="Beğendiğin ürünleri, istediğin fiyata bir adım daha yaklaştır."
        action={
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            component={Link}
            to="/watchlist/new"
          >
            Ürün ekle
          </Button>
        }
      />
      {error && (
        <Alert
          severity="error"
          action={
            <Button onClick={reload} disabled={refreshing}>
              Tekrar dene
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      <Paper variant="outlined" className="overview-strip">
        {[
          {
            label: "Takip listende",
            count: watches.length,
            detail: "ürün",
            icon: <ShoppingBagOutlined />,
          },
          {
            label: "Okunmamış bildirim",
            count: unread,
            detail: unread ? "göz atmaya değer" : "takibe devam ediyoruz",
            icon: <TrendingDownRounded />,
          },
          {
            label: "Hedef fiyatına ulaşan",
            count: matched,
            detail: matched ? "tam zamanı" : "beklemeye değer",
            icon: <TrackChangesRounded />,
          },
        ].map((stat) => (
          <div className="overview-stat" key={stat.label}>
            <span className="overview-stat__icon">{stat.icon}</span>
            <div>
              <Typography variant="body2" color="text.secondary">
                {stat.label}
              </Typography>
              <div className="overview-stat__value">
                <strong>{loading ? "—" : stat.count}</strong>
                <Typography variant="caption" color="text.secondary">
                  {stat.detail}
                </Typography>
              </div>
            </div>
          </div>
        ))}
      </Paper>
      <section className="watchlist-section">
        <div className="section-heading">
          <div>
            <Typography variant="h2">Takip listem</Typography>
            <span className="nav-count">{watches.length}</span>
          </div>
          <Button
            onClick={reload}
            disabled={refreshing}
            startIcon={<RefreshRounded />}
            size="small"
          >
            {refreshing ? "Güncelleniyor…" : "Güncelle"}
          </Button>
        </div>
        <div className="watchlist-toolbar">
          <Tabs
            value={filter}
            onChange={(_, value) => change("filter", value)}
            aria-label="Takip listesini filtrele"
          >
            <Tab label="Tüm ürünler" value="all" />
            <Tab label="Hedef fiyata ulaştı" value="targets" />
            <Tab label="Kontrol bekleyenler" value="issues" />
          </Tabs>
          <TextField
            size="small"
            placeholder="Takip listende ara…"
            value={query}
            onChange={(event) => change("q", event.target.value)}
            slotProps={{
              htmlInput: { "aria-label": "Takip listesinde ara" },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </div>
        <div className="secondary-toolbar">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={store}
            onChange={(_, value) => {
              if (value) change("store", value);
            }}
            aria-label="Mağazaya göre filtrele"
          >
            <ToggleButton value="all">Tüm mağazalar</ToggleButton>
            <ToggleButton value="trendyol">Trendyol</ToggleButton>
            <ToggleButton value="hepsiburada">Hepsiburada</ToggleButton>
          </ToggleButtonGroup>
          <div className="sort-controls">
            <TextField
              select
              size="small"
              label="Sırala"
              value={sort}
              onChange={(event) => change("sort", event.target.value)}
            >
              <MenuItem value="newest">Son eklenenler</MenuItem>
              <MenuItem value="price">En düşük fiyat</MenuItem>
              <MenuItem value="name">Ürün adı</MenuItem>
            </TextField>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={layout}
              onChange={(_, value) => {
                if (value) change("layout", value);
              }}
              aria-label="Ürün görünümü"
            >
              <ToggleButton value="grid" aria-label="Kart görünümü">
                <GridViewRounded fontSize="small" />
              </ToggleButton>
              <ToggleButton value="list" aria-label="Liste görünümü">
                <ViewListRounded fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </div>
        </div>
        {loading ? (
          <div
            className="products-grid"
            aria-busy="true"
            aria-label="Takip listesi yükleniyor"
          >
            {[1, 2, 3].map((item) => (
              <Paper variant="outlined" className="product-skeleton" key={item}>
                <Skeleton variant="rectangular" height={232} />
                <div>
                  <Skeleton width="40%" />
                  <Skeleton width="85%" />
                  <Skeleton height={48} />
                  <Skeleton width="60%" />
                </div>
              </Paper>
            ))}
          </div>
        ) : !watches.length ? (
          <EmptyState
            icon={<ShoppingBagOutlined />}
            title="Takip listen bir bağlantıyla başlar."
            description="Beğendiğin bir ürün mü var? Buraya ekle, fiyatını senin için takip edelim."
            action={
              <Button
                variant="contained"
                startIcon={<AddRounded />}
                component={Link}
                to="/watchlist/new"
              >
                İlk ürününü ekle
              </Button>
            }
          />
        ) : !filtered.length ? (
          <EmptyState
            icon={<SearchRounded />}
            title="Burada henüz bir ürün yok."
            description="Farklı bir arama yapabilir veya filtreleri temizleyebilirsin."
            action={
              <Button variant="outlined" onClick={() => setParams({})}>
                Filtreleri temizle
              </Button>
            }
          />
        ) : (
          <div
            className={`products-grid ${layout === "list" ? "products-grid--list" : ""}`}
          >
            {filtered.map((watch) => (
              <ProductCard
                key={watch.id}
                watch={watch}
                alert={alerts.find((alert) => alert.watch === watch.id)}
              />
            ))}
            {layout === "grid" && (
              <Button
                component={Link}
                to="/watchlist/new"
                className="add-product-tile"
              >
                <span className="add-product-tile__icon">
                  <AddRounded />
                </span>
                <strong>Bir ürün mü beğendin?</strong>
                <span>Takip listende ona da yer aç.</span>
                <span className="add-product-tile__link">
                  Ürün ekle <ArrowOutwardRounded fontSize="small" />
                </span>
              </Button>
            )}
          </div>
        )}
        <div className="watchlist-note">
          <InfoOutlined fontSize="small" />
          <Typography variant="caption" color="text.secondary">
            Fiyatlar son başarılı kontrolden alınır. Ödeme sırasında farklılık
            gösterebilir.
          </Typography>
        </div>
      </section>
      <Outlet />
    </>
  );
}
