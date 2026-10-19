import { Typography } from "@mui/material";
import type { ReactNode } from "react";

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="empty-state">
      <span className="empty-state__icon">{icon}</span>
      <Typography variant="h2">{title}</Typography>
      <Typography color="text.secondary">{description}</Typography>
      {action}
    </section>
  );
}
