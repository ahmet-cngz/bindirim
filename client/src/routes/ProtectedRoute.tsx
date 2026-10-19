import { Alert, Button } from "@mui/material";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Brand from "../components/common/Brand";
import LoadingState from "../components/common/LoadingState";

export default function ProtectedRoute() {
  const { user, token, loading, error, retry, clearSession } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState />;
  if (token && error)
    return (
      <main className="connection-screen">
        <Brand />
        <Alert severity="error">{error}</Alert>
        <Button variant="contained" onClick={retry}>
          Tekrar dene
        </Button>
        <Button onClick={clearSession}>Giriş ekranına dön</Button>
      </main>
    );
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <Outlet />;
}
