/**
 * TextInputModal Component
 * Interactive text entry dialog for sending typed strings from phone to TV search fields and login inputs.
 */

import { Keyboard, Mic, Send, Undo2, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { THEME } from '../utils/constants';

interface TextInputModalProps {
  visible: boolean;
  onSendText: (text: string) => Promise<{ success: boolean; message: string }>;
  onClose: () => void;
  onOpenVoice?: () => void;
}

export const TextInputModal: React.FC<TextInputModalProps> = ({
  visible,
  onSendText,
  onClose,
  onOpenVoice,
}) => {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const inputRef = useRef<any>(null);
  const { triggerSuccess, triggerError, triggerLight } = useHaptics();

  useEffect(() => {
    if (visible) {
      setText('');
      setStatusMessage(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [visible]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setIsSending(true);
    setStatusMessage(null);

    try {
      const res = await onSendText(text.trim());
      if (res.success) {
        triggerSuccess();
        setStatusMessage(res.message);
        setText('');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        triggerError();
        setStatusMessage(res.message);
      }
    } catch (e: any) {
      triggerError();
      setStatusMessage(e?.message || 'Failed to send text to TV');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Keyboard size={20} color={THEME.colors.primary} />
              <Text style={styles.title}>Send Text to TV</Text>
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

          <Text style={styles.description}>
            Type on your phone to search movies or fill input fields on your TV.
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Search movies, channels, login..."
              placeholderTextColor={THEME.colors.textMuted}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              autoCorrect={false}
            />

            {onOpenVoice ? (
              <TouchableOpacity
                style={styles.micButton}
                onPress={() => {
                  triggerLight();
                  onClose();
                  onOpenVoice();
                }}
              >
                <Mic size={20} color={THEME.colors.primary} />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.sendButton,
                (!text.trim() || isSending) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!text.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Send size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          {/* QUICK IME CONTROL ROW */}
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={styles.actionPill}
              onPress={() => {
                triggerLight();
                remoteService.deleteCharacters(1);
              }}
            >
              <Undo2 size={15} color={THEME.colors.textSecondary} />
              <Text style={styles.actionPillText}>Delete / Backspace</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionPill}
              onPress={() => {
                triggerLight();
                remoteService.sendEnterKey();
              }}
            >
              <Send size={15} color={THEME.colors.primary} />
              <Text style={[styles.actionPillText, { color: THEME.colors.primary }]}>
                Submit / Enter
              </Text>
            </TouchableOpacity>
          </View>

          {statusMessage ? (
            <Text style={styles.statusText}>{statusMessage}</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: THEME.borderRadius.lg,
    borderTopRightRadius: THEME.borderRadius.lg,
    padding: 20,
    borderTopWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  closeButton: {
    padding: 6,
  },
  description: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 50,
    color: THEME.colors.textPrimary,
    fontSize: 16,
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  sendButtonDisabled: {
    backgroundColor: THEME.colors.textMuted,
    opacity: 0.5,
  },
  statusText: {
    marginTop: 10,
    fontSize: 13,
    color: THEME.colors.accentGreen,
    textAlign: 'center',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
  },
  actionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
});
