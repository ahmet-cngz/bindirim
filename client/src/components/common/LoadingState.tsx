import { CircularProgress, Typography } from "@mui/material";
export default function LoadingState({
  label = "Ürünlerin hazırlanıyor…",
}: {
  label?: string;
}) {
  return (
    <div className="loading-state" role="status">
      <CircularProgress size={24} />
      <Typography color="text.secondary">{label}</Typography>
    </div>
  );
}
