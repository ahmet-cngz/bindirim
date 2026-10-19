import { Typography } from "@mui/material";
import type { ReactNode } from "react";

export default function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <Typography variant="overline" color="text.secondary">
          {eyebrow}
        </Typography>
        <Typography variant="h1">
          {title}
          <span className="brand__dot">.</span>
        </Typography>
        <Typography color="text.secondary">{description}</Typography>
      </div>
      {action}
    </header>
  );
}
