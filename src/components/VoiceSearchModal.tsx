/**
 * VoiceSearchModal Component
 * Interactive Voice Search Dialog for TV searching (YouTube, TV input, universal search).
 * Takes speech input from phone microphone (expo-av) or keyboard dictation,
 * and sends it directly to YouTube or active TV input box.
 */

import { Check, Edit2, Mic, MicOff, Play, Search, Sparkles, Tv, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useHaptics } from '../hooks/useHaptics';
import { remoteService } from '../services/remoteService';
import { VoiceService } from '../services/voiceService';
import { THEME } from '../utils/constants';

interface VoiceSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSearchSubmitted?: (query: string) => void;
}

const QUICK_SUGGESTIONS = [
  'lofi hip hop',
  'trending music',
  'latest news',
  'funny comedy',
  '4k hdr demo',
  'live sports',
];

export const VoiceSearchModal: React.FC<VoiceSearchModalProps> = ({
  visible,
  onClose,
  onSearchSubmitted,
}) => {
  const { triggerLight, triggerMedium, triggerSuccess, triggerError } = useHaptics();

  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [query, setQuery] = useState('');
  const [statusText, setStatusText] = useState('Tap microphone to speak into phone');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setIsSent(false);
      setIsListening(false);
      setIsTranscribing(false);
      setStatusText('Tap microphone to speak into phone');
      stopPulse();
    } else {
      VoiceService.stopListening();
      setIsListening(false);
      setIsTranscribing(false);
      stopPulse();
    }
  }, [visible]);

  const startPulse = () => {
    pulseAnim.setValue(1);
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.35,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    if (pulseLoop.current) {
      pulseLoop.current.stop();
      pulseLoop.current = null;
    }
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const handleToggleMic = async () => {
    triggerMedium();

    if (isListening) {
      // User tapped stop: finish recording and transcribe speech
      stopPulse();
      setIsListening(false);
      setIsTranscribing(true);
      setStatusText('Transcribing speech...');

      try {
        const text = await VoiceService.stopRecordingAndTranscribe();
        if (text) {
          setQuery(text);
          setStatusText(`Recognized: "${text}"`);
          triggerSuccess();
        } else {
          setStatusText('No speech detected. Tap mic to retry.');
        }
      } catch (err: any) {
        setStatusText(err?.message || 'Could not recognize speech');
        triggerError();
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // User tapped start: begin listening from phone microphone
      try {
        setQuery('');
        setIsListening(true);
        startPulse();
        setStatusText('Listening... Speak now into your phone');

        await VoiceService.startRecording((status) => {
          setStatusText(status);
        });
      } catch (err: any) {
        stopPulse();
        setIsListening(false);
        setStatusText('Mic unavailable. Type or use keyboard voice.');
        inputRef.current?.focus();
        triggerError();
      }
    }
  };

  const handleSearchYouTube = async (searchQuery: string) => {
    const textToSend = searchQuery.trim();
    if (!textToSend || isSending) return;

    triggerSuccess();
    setIsSending(true);
    setIsSent(true);
    setStatusText(`Searching YouTube for "${textToSend}"...`);

    try {
      await VoiceService.searchYouTubeOnTv(textToSend);
      if (onSearchSubmitted) {
        onSearchSubmitted(textToSend);
      }
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch {
      setStatusText('Failed to open YouTube search');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendToTV = async (searchQuery: string) => {
    const textToSend = searchQuery.trim();
    if (!textToSend || isSending) return;

    triggerSuccess();
    setIsSending(true);
    setIsSent(true);
    setStatusText(`Typing "${textToSend}" on TV...`);

    try {
      await VoiceService.sendSearchQueryToTv(textToSend);
      if (onSearchSubmitted) {
        onSearchSubmitted(textToSend);
      }
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch {
      setStatusText('Failed to send text to TV');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Sparkles size={20} color={THEME.colors.primary} />
              <Text style={styles.title}>Voice Search</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                triggerLight();
                onClose();
              }}
              style={styles.closeButton}
            >
              <X size={20} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* MAIN MIC BUTTON & PULSE */}
          <View style={styles.micSection}>
            <Animated.View
              style={[
                styles.pulseRing,
                isListening && styles.pulseRingActive,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <TouchableOpacity
              style={[
                styles.micButton,
                isListening && styles.micButtonActive,
                isTranscribing && styles.micButtonTranscribing,
              ]}
              onPress={handleToggleMic}
              disabled={isTranscribing}
              activeOpacity={0.8}
            >
              {isTranscribing ? (
                <ActivityIndicator size="large" color="#FFFFFF" />
              ) : (
                <Mic
                  size={36}
                  color={isListening ? '#FFFFFF' : THEME.colors.primary}
                />
              )}
            </TouchableOpacity>
            <Text style={styles.statusLabel}>{statusText}</Text>
          </View>

          {/* VOICE SEARCH INPUT BOX */}
          <View style={styles.inputContainer}>
            <Search size={18} color={THEME.colors.textMuted} style={styles.searchIcon} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Speak with mic above or keyboard..."
              placeholderTextColor={THEME.colors.textMuted}
              returnKeyType="search"
              onSubmitEditing={() => handleSearchYouTube(query)}
            />
            {query.trim().length > 0 ? (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setQuery('')}
              >
                <X size={16} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* ACTION BUTTONS (YOUTUBE & TV INPUT) */}
          {query.trim().length > 0 ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnYouTube]}
                onPress={() => handleSearchYouTube(query)}
                disabled={isSending}
                activeOpacity={0.8}
              >
                <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={styles.actionBtnText}>Search YouTube</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnType]}
                onPress={() => handleSendToTV(query)}
                disabled={isSending}
                activeOpacity={0.8}
              >
                <Tv size={16} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Type on TV</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* QUICK TOPIC SUGGESTIONS */}
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsHeader}>QUICK YOUTUBE SEARCH</Text>
            <View style={styles.pillsRow}>
              {QUICK_SUGGESTIONS.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.pill}
                  onPress={() => {
                    setQuery(suggestion);
                    handleSearchYouTube(suggestion);
                  }}
                >
                  <Text style={styles.pillText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderTopWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  micSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  pulseRingActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  micButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: THEME.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.primary,
    elevation: 4,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  micButtonActive: {
    backgroundColor: '#EF4444',
    borderColor: '#F87171',
    shadowColor: '#EF4444',
  },
  micButtonTranscribing: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  statusLabel: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: THEME.colors.textPrimary,
  },
  clearButton: {
    padding: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    elevation: 2,
  },
  actionBtnYouTube: {
    backgroundColor: '#DC2626',
  },
  actionBtnType: {
    backgroundColor: THEME.colors.primary,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  suggestionsContainer: {
    marginTop: 6,
    marginBottom: 8,
  },
  suggestionsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  pillText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
});
