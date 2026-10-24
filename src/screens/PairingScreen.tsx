/**
 * PairingScreen - PIN Code Verification Screen
 * Simple, focused screen for entering the numeric pairing code displayed on the TV.
 */

import { AlertCircle, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DiscoveredTV, TVConnectionState } from '../types/device';
import { THEME } from '../utils/constants';

interface PairingScreenProps {
  tv: DiscoveredTV | null;
  connectionState: TVConnectionState;
  errorMessage: string | null;
  pinLength?: number;
  onSubmitPin: (pin: string) => Promise<boolean>;
  onCancel: () => void;
  onRetry: () => void;
}

export const PairingScreen: React.FC<PairingScreenProps> = ({
  tv,
  connectionState,
  errorMessage,
  pinLength = 8,
  onSubmitPin,
  onCancel,
  onRetry,
}) => {
  const [pin, setPin] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const isPairing = connectionState === 'pairing';
  const isFailed = connectionState === 'failed';
  const activeError = localError || errorMessage;

  const handlePair = async () => {
    const trimmed = pin.trim();
    if (!trimmed) {
      setLocalError('Please enter the code shown on your TV');
      return;
    }

    setLocalError(null);
    try {
      await onSubmitPin(trimmed);
    } catch (e: any) {
      setLocalError(e?.message || 'Failed to verify pairing code');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header Close/Cancel Button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onCancel}
            disabled={isPairing}
            accessibilityLabel="Cancel pairing"
            accessibilityRole="button"
          >
            <X size={22} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Simple Title & Message */}
          <Text style={styles.title}>Enter pairing code</Text>
          <Text style={styles.instruction}>
            Enter the code displayed on your TV screen.
          </Text>

          {/* Error Banner */}
          {activeError ? (
            <View style={styles.errorBanner}>
              <AlertCircle size={18} color={THEME.colors.accentRed} />
              <Text style={styles.errorText}>{activeError}</Text>
            </View>
          ) : null}

          {/* Code Input Field */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.pinInput,
                activeError ? styles.pinInputError : null,
                isPairing ? styles.pinInputDisabled : null,
              ]}
              value={pin}
              onChangeText={(text) => {
                setPin(text.toUpperCase());
                setLocalError(null);
              }}
              placeholder="Code"
              placeholderTextColor="#475569"
              keyboardType="default"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              autoFocus
              editable={!isPairing}
              textAlign="center"
              returnKeyType="done"
              onSubmitEditing={handlePair}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {isFailed ? (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setPin('');
                  setLocalError(null);
                  onRetry();
                }}
                disabled={isPairing}
              >
                <Text style={styles.retryText}>Retry Pairing</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.pairButton,
                (!pin.trim() || isPairing) && styles.pairButtonDisabled,
              ]}
              onPress={handlePair}
              disabled={!pin.trim() || isPairing}
              accessibilityLabel="Pair TV"
              accessibilityRole="button"
            >
              {isPairing ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.pairButtonText}>Verifying with TV...</Text>
                </View>
              ) : (
                <Text style={styles.pairButtonText}>Pair TV</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={isPairing}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'flex-start',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    color: THEME.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  instruction: {
    color: THEME.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    maxWidth: 290,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    maxWidth: 320,
  },
  errorText: {
    color: THEME.colors.accentRed,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  inputWrapper: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 28,
  },
  pinInput: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 2,
    borderColor: THEME.colors.surfaceBorder,
    borderRadius: 14,
    height: 64,
    fontSize: 24,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: 4,
    paddingHorizontal: 12,
  },
  pinInputError: {
    borderColor: THEME.colors.accentRed,
  },
  pinInputDisabled: {
    opacity: 0.5,
  },
  actions: {
    width: '100%',
    maxWidth: 280,
    gap: 12,
  },
  pairButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairButtonDisabled: {
    opacity: 0.4,
  },
  pairButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  retryButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: THEME.colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
});
