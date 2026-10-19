import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { theme } from "./styles/theme";
import { AuthProvider } from "./hooks/useAuth";
import { WatchlistProvider } from "./hooks/useWatchlist";
import { FeedbackProvider } from "./hooks/useFeedback";
import ProtectedRoute from "./routes/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import AddProductDialog from "./components/products/AddProductDialog";
import AuthPage from "./pages/AuthPage";
import WatchlistPage from "./pages/WatchlistPage";
import ProductPage from "./pages/ProductPage";
import AlertsPage from "./pages/AlertsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFoundPage from "./pages/NotFoundPage";
import "./styles/main.scss";

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <BrowserRouter>
        <AuthProvider>
          <FeedbackProvider>
            <Routes>
              <Route path="/login" element={<AuthPage />} />
              <Route path="/signup" element={<AuthPage signup />} />
              <Route element={<ProtectedRoute />}>
                <Route
                  element={
                    <WatchlistProvider>
                      <AppLayout />
                    </WatchlistProvider>
                  }
                >
                  <Route index element={<Navigate to="/watchlist" replace />} />
                  <Route path="/watchlist" element={<WatchlistPage />}>
                    <Route path="new" element={<AddProductDialog />} />
                  </Route>
                  <Route path="/watchlist/:watchId" element={<ProductPage />} />
                  <Route path="/alerts" element={<AlertsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </FeedbackProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
