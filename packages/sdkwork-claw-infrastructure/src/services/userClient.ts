import { getApi, putApi } from '../http/apiClient.ts';

const USER_BASE_PATH = '/app/v3/api/user';

export interface UserProfileDto {
  nickname?: string;
  avatar?: string;
  gender?: string;
  birthday?: number;
  region?: string;
  bio?: string;
  occupation?: string;
  interests?: string;
  phone?: string;
  email?: string;
}

export interface UserProfileUpdateRequest {
  nickname?: string;
  gender?: string;
  bio?: string;
  phone?: string;
  email?: string;
}

export interface UserSettingsDto {
  theme?: string;
  language?: string;
  notificationSettings?: {
    system?: boolean;
    message?: boolean;
    activity?: boolean;
    promotion?: boolean;
    sound?: boolean;
    vibration?: boolean;
  };
}

export interface PasswordChangeRequest {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function getUserProfile() {
  return getApi<UserProfileDto>(`${USER_BASE_PATH}/profile`);
}

export function updateUserProfile(request: UserProfileUpdateRequest) {
  return putApi<UserProfileDto>(`${USER_BASE_PATH}/profile`, request);
}

export function changePassword(request: PasswordChangeRequest) {
  return putApi<void>(`${USER_BASE_PATH}/password`, request);
}

export function getUserSettings() {
  return getApi<UserSettingsDto>(`${USER_BASE_PATH}/settings`);
}

export function updateUserSettings(request: UserSettingsDto) {
  return putApi<UserSettingsDto>(`${USER_BASE_PATH}/settings`, request);
}
