/**
 * Streaming Application Launcher
 * Launches streaming apps on Android TV using registered deep link intents:
 * - Netflix: netflix://
 * - JioHotstar: https://www.hotstar.com
 * - YouTube: vnd.youtube:// or https://www.youtube.com
 */

import { StreamingAppId } from '../types/remote';
import { STREAMING_APPS } from '../utils/constants';
import { remoteService } from './remoteService';

export class AppLauncherService {
  /**
   * Launches a streaming app by ID
   */
  public static async launch(appId: StreamingAppId): Promise<{ success: boolean; message: string }> {
    const appInfo = STREAMING_APPS[appId];
    if (!appInfo) {
      return { success: false, message: `Unknown app shortcut: ${appId}` };
    }

    if (!remoteService.getIsConnected()) {
      return { success: false, message: 'Please connect to your TV first.' };
    }

    try {
      await remoteService.launchApp(appInfo.deepLink);
      return {
        success: true,
        message: `Opening ${appInfo.name} on TV...`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `Failed to launch ${appInfo.name}`,
      };
    }
  }

  public static getAppInfo(appId: StreamingAppId) {
    return STREAMING_APPS[appId];
  }
}
