import { PlatformAPI } from '../platform';
import { WebPlatform } from './web';

// In a real Tauri app, we would dynamically check window.__TAURI__
// and import the DesktopPlatform implementation.
// For this web-based preview, we default to WebPlatform.

export const platform: PlatformAPI = new WebPlatform();
