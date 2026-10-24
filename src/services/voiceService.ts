/**
 * Voice Service
 * Provides Voice Search capabilities and Speech Recognition support
 * without requiring unlinked native modules.
 */

import { remoteService } from './remoteService';

export interface VoiceRecognitionResult {
  success: boolean;
  text: string;
  error?: string;
}

export class VoiceService {
  private static isListening: boolean = false;
  private static recognitionInstance: any = null;

  /**
   * Checks if browser/system Web Speech API is supported
   */
  public static isWebSpeechSupported(): boolean {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      return Boolean(SpeechRecognition);
    }
    return false;
  }

  /**
   * Starts listening using Web Speech API if supported
   */
  public static startListening(
    onResult: (text: string) => void,
    onError: (error: string) => void
  ): boolean {
    if (!this.isWebSpeechSupported()) {
      return false;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('[VoiceService] Recognized:', transcript);
        this.isListening = false;
        onResult(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('[VoiceService] Speech error:', event.error);
        this.isListening = false;
        onError(event.error);
      };

      recognition.onend = () => {
        this.isListening = false;
      };

      recognition.start();
      this.recognitionInstance = recognition;
      this.isListening = true;
      return true;
    } catch (e: any) {
      console.warn('[VoiceService] Start listening error:', e);
      this.isListening = false;
      onError(e?.message || 'Could not start voice recognition');
      return false;
    }
  }

  /**
   * Stops active speech recognition
   */
  public static stopListening(): void {
    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.stop();
      } catch {}
      this.recognitionInstance = null;
    }
    this.isListening = false;
  }

  /**
   * Triggers the TV's native Voice / Universal Search assistant on the TV display
   */
  public static triggerTvVoiceSearch(): boolean {
    console.log('[VoiceService] Triggering TV native Voice Search overlay');
    return remoteService.sendButton('SEARCH');
  }

  /**
   * Sends voice search query text to TV and presses Enter to search
   */
  public static async sendSearchQueryToTv(query: string): Promise<boolean> {
    const textToSend = query.trim();
    if (!textToSend) return false;

    console.log(`[VoiceService] Sending search query "${textToSend}" to TV...`);
    // 1. Insert search text into TV
    await remoteService.sendText(textToSend);
    // 2. Submit search by pressing Enter (IME enter + hardware Enter)
    setTimeout(() => {
      remoteService.sendEnterKey();
    }, 250);

    return true;
  }

  public static getIsListening(): boolean {
    return this.isListening;
  }
}
