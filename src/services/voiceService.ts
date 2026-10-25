/**
 * Voice Service
 * Provides Voice Search capabilities, Audio Recording via expo-av,
 * bridge-assisted Speech Recognition, and YouTube Search launcher.
 */

import { Audio } from 'expo-av';
import { getDevBridgeHost } from '../utils/devBridge';
import { remoteService } from './remoteService';

export interface VoiceRecognitionResult {
  success: boolean;
  text: string;
  error?: string;
}

export class VoiceService {
  private static isListening: boolean = false;
  private static currentRecording: Audio.Recording | null = null;
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
   * Starts recording audio from the phone's microphone using expo-av
   */
  public static async startRecording(
    onStatusChange?: (status: string) => void
  ): Promise<boolean> {
    try {
      // 1. Check Web Speech API first (if in web preview)
      if (this.isWebSpeechSupported()) {
        return true;
      }

      // 2. Request microphone permission
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Microphone permission not granted');
      }

      // 3. Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Clean up any stale recording
      if (this.currentRecording) {
        try {
          await this.currentRecording.stopAndUnloadAsync();
        } catch {}
        this.currentRecording = null;
      }

      // 4. Start recording in HIGH_QUALITY
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      this.currentRecording = recording;
      this.isListening = true;
      if (onStatusChange) onStatusChange('Listening... Speak into phone');
      return true;
    } catch (err: any) {
      console.warn('[VoiceService] Start recording failed:', err);
      this.isListening = false;
      throw err;
    }
  }

  /**
   * Stops recording and transcribes speech using dev bridge / transcription engine
   */
  public static async stopRecordingAndTranscribe(): Promise<string> {
    if (!this.currentRecording) {
      this.isListening = false;
      return '';
    }

    try {
      const rec = this.currentRecording;
      this.currentRecording = null;
      this.isListening = false;

      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) {
        throw new Error('No audio recorded');
      }

      console.log('[VoiceService] Audio recorded to:', uri);

      // Convert audio file to Base64
      const response = await fetch(uri);
      const blob = await response.blob();

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onloadend = () => {
          const res = reader.result as string;
          const commaIdx = res.indexOf(',');
          resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
        };
        reader.readAsDataURL(blob);
      });

      // Send to bridge transcription server
      const host = getDevBridgeHost() || '192.168.29.120';
      const transcribeUrl = `http://${host}:3002/transcribe`;
      console.log('[VoiceService] Transcribing audio via', transcribeUrl);

      const transcribeRes = await fetch(transcribeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64Data }),
      });

      if (!transcribeRes.ok) {
        throw new Error(`Transcription server error (${transcribeRes.status})`);
      }

      const result = await transcribeRes.json();
      console.log('[VoiceService] Transcription result:', result);

      if (result.success && result.text) {
        return result.text.trim();
      }

      if (result.text) {
        return result.text.trim();
      }

      throw new Error(result.error || 'No speech recognized');
    } catch (err: any) {
      console.warn('[VoiceService] Transcription failed:', err.message);
      throw err;
    }
  }

  /**
   * Cancel active recording
   */
  public static async cancelRecording(): Promise<void> {
    if (this.currentRecording) {
      try {
        await this.currentRecording.stopAndUnloadAsync();
      } catch {}
      this.currentRecording = null;
    }
    this.isListening = false;
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
    this.cancelRecording();
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
   * Directly launches YouTube on TV with the specified search query
   */
  public static async searchYouTubeOnTv(query: string): Promise<boolean> {
    const textToSend = query.trim();
    if (!textToSend) return false;

    console.log(`[VoiceService] Opening YouTube on TV searching for "${textToSend}"...`);
    return remoteService.searchYouTube(textToSend);
  }

  /**
   * Sends voice search query text to TV input field and presses Enter to search
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
