import { useState } from "react";
import { Alert, FormControlLabel, Paper, Switch, Typography } from "@mui/material";
import MailOutlineRounded from "@mui/icons-material/MailOutlineRounded";
import { errorMessage } from "../../../utils/watch";
import type { NotificationSettingsProps } from "./NotificationSettings.types";

const NotificationSettings = ({ user, onSave }: NotificationSettingsProps) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const change = async (enabled: boolean) => {
    setSaving(true);
    setError("");
    try {
      await onSave({ email_notifications_enabled: enabled });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Paper variant="outlined" className="settings-panel">
      <span className="panel-icon"><MailOutlineRounded /></span>
      <Typography variant="h2">Bildirim tercihlerin</Typography>
      <Typography variant="body2" color="text.secondary">
        Uygulama içi bildirimler açık. E-posta seçeneğini açarsan, bildirimleri açık
        ürünlerinde fiyat düştüğünde {user.email} adresine de haber veririz.
        Belirlediğin hedef fiyatlar e-posta bildirimleri için de geçerlidir.
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={user.email_notifications_enabled}
            disabled={saving || (!user.email_notifications_available && !user.email_notifications_enabled)}
            onChange={(_, checked) => { void change(checked); }}
          />
        }
        label={saving ? "Kaydediliyor…" : "Fiyat düşüşlerini e-postayla bildir"}
      />
      {!user.email_notifications_available && (
        <Alert severity="info">E-posta bildirimleri henüz etkinleştirilmedi.</Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}
    </Paper>
  );
};

export default NotificationSettings;
