import { Button } from "@mui/material";
import SearchRounded from "@mui/icons-material/SearchRounded";
import { Link } from "react-router-dom";
import EmptyState from "../components/common/EmptyState";

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={<SearchRounded />}
      title="Bu sayfa bulunamadı."
      description="Seni takip listene geri götürelim."
      action={
        <Button variant="contained" component={Link} to="/watchlist">
          Takip listesine dön
        </Button>
      }
    />
  );
}
