/**
 * Haptic Feedback Hook (Disabled per user request)
 * Guarantees zero vibration and silent operation.
 */

import { useCallback, useEffect } from 'react';
import { Vibration } from 'react-native';

export function useHaptics() {
  useEffect(() => {
    try {
      Vibration.cancel();
    } catch {
      // Ignore
    }
  }, []);

  const triggerLight = useCallback(() => {}, []);
  const triggerMedium = useCallback(() => {}, []);
  const triggerSuccess = useCallback(() => {}, []);
  const triggerError = useCallback(() => {}, []);

  return {
    triggerLight,
    triggerMedium,
    triggerSuccess,
    triggerError,
  };
}
