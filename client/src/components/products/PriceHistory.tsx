import { useState } from "react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Observation } from "../../types/models";
import { dateTime, money, offerLabel } from "../../utils/format";
import EmptyState from "../common/EmptyState";
import TimelineRounded from "@mui/icons-material/TimelineRounded";

export default function PriceHistory({
  observations,
}: {
  observations: Observation[];
}) {
  const [table, setTable] = useState(false);
  const points = observations
    .filter((point) => point.price !== null)
    .slice()
    .reverse();
  if (!observations.length)
    return (
      <EmptyState
        icon={<TimelineRounded />}
        title="Fiyat geçmişi burada başlar."
        description="İlk kontrolden sonra ürünün fiyatını burada görebilirsin."
      />
    );
  const latest = points[points.length - 1];
  let index = points.length - 1;
  while (
    index >= 0 &&
    points[index].offer_label === latest?.offer_label &&
    points[index].currency === latest?.currency
  )
    index--;
  const series = points.slice(index + 1);
  const values = series.map((point) => Number(point.price));
  const low = Math.min(...values),
    high = Math.max(...values);
  const range = high - low;
  const startTime = series.length
    ? new Date(series[0].observed_at).getTime()
    : 0;
  const endTime = latest ? new Date(latest.observed_at).getTime() : 0;
  const x = (point: Observation) =>
    endTime === startTime
      ? 280
      : 24 +
        ((new Date(point.observed_at).getTime() - startTime) /
          (endTime - startTime)) *
          512;
  const y = (value: number) =>
    range === 0 ? 96 : 152 - ((value - low) / range) * 112;
  const line = series
    .map((point) => `${x(point)},${y(Number(point.price))}`)
    .join(" ");
  return (
    <div className="price-history">
      <div className="price-history__summary">
        <div>
          <Typography variant="body2" color="text.secondary">
            Bu satıcı ve seçenek için görülen en düşük fiyat
          </Typography>
          <Typography variant="h2">
            {values.length ? money(low, latest.currency) : "Fiyat bilgisi yok"}
          </Typography>
        </div>
        <Button size="small" onClick={() => setTable(!table)}>
          {table ? "Kayıtları gizle" : "Kayıtları göster"}
        </Button>
      </div>
      {series.length > 0 && (
        <>
          <svg
            viewBox="0 0 560 192"
            className="price-chart"
            role="img"
            aria-label={`Fiyat geçmişi: ${series.length} kayıt. En düşük ${money(low, latest.currency)}, en yüksek ${money(high, latest.currency)}.`}
          >
            {[40, 96, 152].map((value) => (
              <line
                key={value}
                x1="24"
                x2="536"
                y1={value}
                y2={value}
                className="price-chart__grid"
              />
            ))}
            <polyline points={line} className="price-chart__line" />
            {series.map((point) => (
              <circle
                key={point.id}
                cx={x(point)}
                cy={y(Number(point.price))}
                r="4"
                className="price-chart__point"
              >
                <title>
                  {dateTime(point.observed_at)}:{" "}
                  {money(point.price, point.currency)}
                </title>
              </circle>
            ))}
            <text x="24" y="184">
              {dateTime(series[0].observed_at)}
            </text>
            {series.length > 1 && (
              <text x="536" y="184" textAnchor="end">
                {dateTime(latest.observed_at)}
              </text>
            )}
          </svg>
          <Typography variant="caption" color="text.secondary">
            {series.length === 1
              ? "Bir fiyat kaydedildi. Her yeni kontrolle grafik güncellenir."
              : "Kaydedilen gerçek fiyatlar gösterilir. Satıcı veya ürün seçeneği değiştiğinde yeni bir grafik bölümü başlar."}
          </Typography>
        </>
      )}
      {table && (
        <TableContainer>
          <Table size="small" aria-label="Kaydedilen ürün fiyatları">
            <TableHead>
              <TableRow>
                <TableCell>Kontrol zamanı</TableCell>
                <TableCell>Satıcı ve seçenek</TableCell>
                <TableCell align="right">Fiyat</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {observations.map((point) => (
                <TableRow key={point.id}>
                  <TableCell>{dateTime(point.observed_at)}</TableCell>
                  <TableCell>
                    {offerLabel(point.offer_label) || "Ürün sayfasındaki fiyat"}
                    {["out_of_stock", "unavailable"].includes(
                      point.availability,
                    ) && " · Mevcut değil"}
                  </TableCell>
                  <TableCell align="right">
                    {point.price === null
                      ? "Mevcut değil"
                      : money(point.price, point.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
