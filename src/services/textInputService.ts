/**
 * Text Input Service (Remote IME synchronization)
 * Sends strings typed on the phone's keyboard directly into TV input/search boxes.
 */

import { remoteService } from './remoteService';

export class TextInputService {
  /**
   * Sends text input to TV
   */
  public static async sendText(text: string): Promise<{ success: boolean; message: string }> {
    if (!remoteService.getIsConnected()) {
      return { success: false, message: 'Please connect to your TV first.' };
    }

    if (!text || text.length === 0) {
      return { success: false, message: 'Text cannot be empty' };
    }

    try {
      await remoteService.sendTextAndSubmit(text);
      return { success: true, message: `Sent to TV: "${text}"` };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Failed to send text to TV' };
    }
  }
}
