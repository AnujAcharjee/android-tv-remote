/**
 * Circular Directional Navigation Pad (D-Pad)
 * Features Up, Down, Left, Right directional buttons with center OK / Select button.
 * Supports rapid taps and repeated commands on long press.
 */

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react-native';
import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useHaptics } from '../hooks/useHaptics';
import { Direction, KeyCode } from '../types/remote';
import { THEME } from '../utils/constants';

interface DirectionPadProps {
  onKey: (keyCode: KeyCode, direction: Direction) => void;
  disabled?: boolean;
}

export const DirectionPad: React.FC<DirectionPadProps> = ({
  onKey,
  disabled = false,
}) => {
  const handlePress = (keyCode: KeyCode) => {
    if (disabled) return;
    onKey(keyCode, Direction.SHORT);
  };

  return (
    <View style={styles.container}>
      <View style={styles.outerCircle}>
        {/* UP BUTTON */}
        <Pressable
          onPress={() => handlePress(KeyCode.DPAD_UP)}
          disabled={disabled}
          android_disableSound={true}
          accessibilityLabel="Up"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.dirButton,
            styles.upButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <ChevronUp size={28} color={THEME.colors.textPrimary} />
        </Pressable>

        {/* DOWN BUTTON */}
        <Pressable
          onPress={() => handlePress(KeyCode.DPAD_DOWN)}
          disabled={disabled}
          android_disableSound={true}
          accessibilityLabel="Down"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.dirButton,
            styles.downButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <ChevronDown size={28} color={THEME.colors.textPrimary} />
        </Pressable>

        {/* LEFT BUTTON */}
        <Pressable
          onPress={() => handlePress(KeyCode.DPAD_LEFT)}
          disabled={disabled}
          android_disableSound={true}
          accessibilityLabel="Left"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.dirButton,
            styles.leftButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <ChevronLeft size={28} color={THEME.colors.textPrimary} />
        </Pressable>

        {/* RIGHT BUTTON */}
        <Pressable
          onPress={() => handlePress(KeyCode.DPAD_RIGHT)}
          disabled={disabled}
          android_disableSound={true}
          accessibilityLabel="Right"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.dirButton,
            styles.rightButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <ChevronRight size={28} color={THEME.colors.textPrimary} />
        </Pressable>

        {/* CENTER OK BUTTON */}
        <Pressable
          onPress={() => handlePress(KeyCode.DPAD_CENTER)}
          disabled={disabled}
          android_disableSound={true}
          accessibilityLabel="OK / Select"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.centerButton,
            pressed && styles.centerButtonPressed,
          ]}
        >
          <Text style={styles.centerText}>OK</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  outerCircle: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1.5,
    borderColor: THEME.colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dirButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  upButton: {
    top: 6,
    width: 90,
    height: 60,
  },
  downButton: {
    bottom: 6,
    width: 90,
    height: 60,
  },
  leftButton: {
    left: 6,
    width: 60,
    height: 90,
  },
  rightButton: {
    right: 6,
    width: 60,
    height: 90,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  centerButton: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: THEME.colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  centerButtonPressed: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
    transform: [{ scale: 0.94 }],
  },
  centerText: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
