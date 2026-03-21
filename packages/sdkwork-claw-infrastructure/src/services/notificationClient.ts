import { getApi, putApi } from '../http/apiClient.ts';

const NOTIFICATION_BASE_PATH = '/app/v3/api/notification';

export interface NotificationTypeSettingsDto {
  type?: string;
  enablePush?: boolean;
  enableInApp?: boolean;
  enableEmail?: boolean;
  enableSms?: boolean;
}

export interface NotificationSettingsDto {
  enablePush?: boolean;
  enableEmail?: boolean;
  enableSms?: boolean;
  enableInApp?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  typeSettings?: Record<string, NotificationTypeSettingsDto>;
}

export interface NotificationSettingsUpdateRequest {
  enablePush?: boolean;
  enableEmail?: boolean;
  enableSms?: boolean;
  enableInApp?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export function getNotificationSettings() {
  return getApi<NotificationSettingsDto>(`${NOTIFICATION_BASE_PATH}/settings`);
}

export function updateNotificationSettings(request: NotificationSettingsUpdateRequest) {
  return putApi<NotificationSettingsDto>(`${NOTIFICATION_BASE_PATH}/settings`, request);
}
