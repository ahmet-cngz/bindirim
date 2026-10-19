import type { User } from "../../../types/models";

import type { NotificationPreferences } from "../../../utils/api.types";

export interface NotificationSettingsProps {
  user: User;
  onSave: (preferences: NotificationPreferences) => Promise<void>;
}
