/**
 * VoiceSearchModal Component
 * Interactive Voice Search Dialog for TV searching.
 * Supports Web Speech API, keyboard voice dictation, TV on-screen voice search,
 * and 1-tap topic search shortcuts.
 */

import { Check, Edit2, Mic, Search, Sparkles, Tv, X } from 'lucide-react-native';
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
  'Avatar',
  'Stranger Things',
  'Action Movies',
  'Comedy Specials',
  'Trending Music',
  'Cartoons for Kids',
  'Live Cricket',
  'Latest News',
];

export const VoiceSearchModal: React.FC<VoiceSearchModalProps> = ({
  visible,
  onClose,
  onSearchSubmitted,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [query, setQuery] = useState('');
  const [statusText, setStatusText] = useState('Tap microphone to speak or search');
  const [isSent, setIsSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<any>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const { triggerSuccess, triggerLight, triggerMedium } = useHaptics();

  useEffect(() => {
    if (visible) {
      setQuery('');
      setIsListening(false);
      setIsSent(false);
      setIsSending(false);
      setStatusText('Tap microphone to speak or search');
    } else {
      stopPulse();
      VoiceService.stopListening();
    }
  }, [visible]);

  const startPulse = () => {
    pulseAnim.setValue(1);
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
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
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleToggleMic = () => {
    triggerMedium();

    if (VoiceService.isWebSpeechSupported()) {
      if (isListening) {
        VoiceService.stopListening();
        setIsListening(false);
        stopPulse();
        setStatusText('Listening stopped');
      } else {
        setIsListening(true);
        startPulse();
        setStatusText('Listening... Speak now');
        VoiceService.startListening(
          (text) => {
            setQuery(text);
            setIsListening(false);
            stopPulse();
            setStatusText(`Recognized: "${text}"`);
            triggerSuccess();
          },
          (err) => {
            setIsListening(false);
            stopPulse();
            setStatusText('Could not hear audio. Tap below to speak.');
          }
        );
      }
    } else {
      // Also send TV Voice Search so TV opens its microphone on screen
      remoteService.sendButton('SEARCH');
      setStatusText('TV Voice search opened! Or speak into input below.');
      inputRef.current?.focus();
    }
  };

  const handleSendToTV = async (searchQuery: string) => {
    const textToSend = searchQuery.trim();
    if (!textToSend || isSending) return;

    triggerSuccess();
    setIsSending(true);
    setIsSent(true);
    setStatusText(`Searching "${textToSend}" on TV...`);

    try {
      await VoiceService.sendSearchQueryToTv(textToSend);

      if (onSearchSubmitted) {
        onSearchSubmitted(textToSend);
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e) {
      setStatusText('Failed to send text to TV');
    } finally {
      setIsSending(false);
    }
  };

  const handleTriggerTVNativeSearch = () => {
    triggerLight();
    VoiceService.triggerTvVoiceSearch();
    setStatusText('TV Voice Search opened on your screen');
    setTimeout(() => {
      onClose();
    }, 800);
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
              style={[styles.micButton, isListening && styles.micButtonActive]}
              onPress={handleToggleMic}
              activeOpacity={0.8}
            >
              <Mic
                size={36}
                color={isListening ? '#FFFFFF' : THEME.colors.primary}
              />
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
              placeholder="Speak with keyboard mic or type..."
              placeholderTextColor={THEME.colors.textMuted}
              returnKeyType="search"
              onSubmitEditing={() => handleSendToTV(query)}
            />
            {query.trim().length > 0 ? (
              <TouchableOpacity
                style={[styles.sendButton, isSent && styles.sendButtonSuccess]}
                onPress={() => handleSendToTV(query)}
                disabled={isSending}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : isSent ? (
                  <Check size={16} color="#FFFFFF" />
                ) : (
                  <Text style={styles.sendButtonText}>Search</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          {/* QUICK TOPIC SUGGESTIONS */}
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsHeader}>QUICK SEARCH</Text>
            <View style={styles.pillsRow}>
              {QUICK_SUGGESTIONS.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.pill}
                  onPress={() => {
                    setQuery(suggestion);
                    handleSendToTV(suggestion);
                  }}
                >
                  <Text style={styles.pillText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* TV NATIVE VOICE SEARCH SHORTCUT */}
          <TouchableOpacity
            style={styles.tvSearchShortcut}
            onPress={handleTriggerTVNativeSearch}
          >
            <Tv size={18} color={THEME.colors.primary} />
            <Text style={styles.tvSearchShortcutText}>
              Open TV's On-Screen Voice Search Overlay
            </Text>
          </TouchableOpacity>
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  pulseRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(235, 127, 36, 0.15)',
  },
  pulseRingActive: {
    backgroundColor: 'rgba(235, 87, 87, 0.35)',
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 2,
    borderColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  micButtonActive: {
    backgroundColor: THEME.colors.accentRed,
    borderColor: '#FFFFFF',
    shadowColor: THEME.colors.accentRed,
  },
  statusLabel: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
    paddingHorizontal: 12,
    marginVertical: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    color: THEME.colors.textPrimary,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    marginLeft: 8,
  },
  sendButtonSuccess: {
    backgroundColor: THEME.colors.accentGreen,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionsContainer: {
    marginTop: 6,
  },
  suggestionsHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: THEME.colors.textMuted,
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  pillText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  tvSearchShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.surfaceBorder,
  },
  tvSearchShortcutText: {
    fontSize: 13,
    color: THEME.colors.primary,
    fontWeight: '600',
  },
});
