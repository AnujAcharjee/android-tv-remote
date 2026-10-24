/**
 * PairingModal Component
 * Interactive PIN entry dialog presented when Android TV requests pairing code.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useHaptics } from '../hooks/useHaptics';
import { DiscoveredTV } from '../types/device';
import { THEME } from '../utils/constants';

interface PairingModalProps {
  visible: boolean;
  tv: DiscoveredTV | null;
  onSubmitPin: (pin: string) => Promise<boolean>;
  onCancel: () => void;
}

export const PairingModal: React.FC<PairingModalProps> = ({
  visible,
  tv,
  onSubmitPin,
  onCancel,
}) => {
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { triggerSuccess, triggerError } = useHaptics();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const success = await onSubmitPin(pin.trim());
      if (success) {
        triggerSuccess();
        setPin('');
      } else {
        triggerError();
        setErrorMessage('Invalid PIN code or pairing rejected by TV');
      }
    } catch (e: any) {
      triggerError();
      setErrorMessage(e?.message || 'Pairing verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Pair with TV</Text>
          <Text style={styles.subtitle}>
            A pairing request was sent to <Text style={styles.tvName}>{tv?.name || 'your TV'}</Text>.
            {'\n'}If a code is displayed on your TV screen, enter it below. If a popup appeared, select "Allow" with your TV remote.
          </Text>

          <TextInput
            style={styles.pinInput}
            value={pin}
            onChangeText={(text) => {
              setPin(text.toUpperCase());
              setErrorMessage(null);
            }}
            placeholder="PIN Code (if shown)"
            placeholderTextColor={THEME.colors.textMuted}
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="default"
            textAlign="center"
          />

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitText}>
                  {pin.trim().length > 0 ? 'Submit Code' : 'I Allowed on TV'}
                </Text>
              )}
            </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  tvName: {
    color: THEME.colors.primary,
    fontWeight: '600',
  },
  pinInput: {
    width: '100%',
    height: 56,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
    color: THEME.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 4,
    marginBottom: 16,
  },
  errorText: {
    color: THEME.colors.accentRed,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  cancelText: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    height: 46,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
