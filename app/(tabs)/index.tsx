import { addHours, format, formatDistanceToNow } from 'date-fns';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { useProfile } from '../../src/hooks/useProfile';
import { api } from '../../src/lib/api';
import { Colors, Spacing, Typography } from '../../src/theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { profile, loading, refetch } = useProfile();
  const [checkingIn, setCheckingIn] = useState(false);
  const [panicModalVisible, setPanicModalVisible] = useState(false);
  const [now, setNow] = useState(new Date());

  // Animation for pulsing button
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Pulsing animation for the button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const { error } = await api.checkIn();
      if (error) throw error;
      Alert.alert(t('common.success'), t('home.success_checkin'));
      refetch();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setCheckingIn(false);
    }
  };

  const handlePanicPress = () => {
    setPanicModalVisible(true);
  };

  const confirmPanic = async () => {
    setPanicModalVisible(false);
    try {
      const { error } = await api.updateProfile({ state: 'ESCALATED' });
      if (error) throw error;
      // No need to alert, the UI will change automatically via real-time or refetch
      refetch();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    }
  };

  if (loading && !profile) {
    return (
      <Screen style={styles.center}>
        <Text style={Typography.body}>{t('home.loading')}</Text>
      </Screen>
    );
  }

  const lastConfirmed = profile?.last_fine_at ? new Date(profile.last_fine_at) : null;
  const nextCheckIn = lastConfirmed
    ? addHours(lastConfirmed, profile?.checkin_interval_hours || 24)
    : null;

  const gracePeriodEnd = nextCheckIn ? addHours(nextCheckIn, 1) : null; // 1 hour grace

  const isOverdue = nextCheckIn && now > nextCheckIn;
  const isGracePeriod = profile?.state === 'GRACE';
  const isVacation = profile?.vacation_mode;

  // New Logic: 
  // If VACATION -> Disabled
  // If OVERDUE / GRACE / ESCALATED -> "I'm Fine" (Green/Amber/Red context)
  // If ACTIVE & NOT OVERDUE -> "I'm NOT Fine" (Red Panic Button)

  const isPanicMode = profile?.state === 'ACTIVE' && !isOverdue && !isVacation;
  const isButtonDisabled = isVacation;

  const stateLabel = isVacation ? t('status.vacation')
    : isGracePeriod ? t('status.grace')
      : (profile?.state === 'ACTIVE' ? t('status.active') : (profile?.state || t('status.unknown')));

  // Color Logic
  const stateColor = isVacation ? Colors.textSecondary
    : isGracePeriod ? Colors.grace
      : isPanicMode ? Colors.escalated
        : Colors.active;

  // Countdown Logic for Grace Period
  const getGraceCountdown = () => {
    if (!gracePeriodEnd) return '';
    const diff = gracePeriodEnd.getTime() - now.getTime();
    if (diff <= 0) return '00:00';
    const m = Math.floor((diff / 1000 / 60) % 60);
    const s = Math.floor((diff / 1000) % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.statusBanner, { backgroundColor: isVacation ? Colors.border : (stateColor + '20'), color: isVacation ? Colors.textSecondary : stateColor }]}>
          {stateLabel}
        </Text>
      </View>

      <View style={styles.main}>
        {isGracePeriod && (
          <View style={styles.graceContainer}>
            <Text style={styles.graceTitle}>{t('message.action_required')}</Text>
            <Text style={styles.graceTimer}>{t('message.escalation_in')} {getGraceCountdown()}</Text>
          </View>
        )}

        {/* Hide last confirmed text during grace period to reduce noise */}
        {!isGracePeriod && (
          <Text style={[Typography.body, styles.lastConfirmed]}>
            {lastConfirmed
              ? t('message.last_confirmed', { time: format(lastConfirmed, 'MMM d, h:mm a') })
              : t('message.no_checkins')}
          </Text>
        )}

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            onPress={isPanicMode ? handlePanicPress : handleCheckIn}
            disabled={isButtonDisabled || checkingIn}
            style={[
              styles.checkInButton,
              { borderColor: isButtonDisabled ? Colors.border : stateColor },
              isButtonDisabled && styles.checkInButtonDisabled
            ]}
          >
            <View style={[
              styles.checkInInner,
              { backgroundColor: isButtonDisabled ? Colors.surface : stateColor },
              isButtonDisabled && styles.checkInInnerDisabled
            ]}>
              <Text style={[
                styles.checkInText,
                isButtonDisabled && { color: Colors.textSecondary }
              ]}>
                {isVacation ? t('action.paused') : (isPanicMode ? t('action.not_fine') : t('action.check_in'))}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {!isGracePeriod && nextCheckIn && (
          <Text style={[Typography.caption, styles.nextCheckIn]}>
            {isOverdue && !isGracePeriod
              ? t('message.was_due', { time: formatDistanceToNow(nextCheckIn, { addSuffix: true }) })
              : t('message.next_due', { time: formatDistanceToNow(nextCheckIn, { addSuffix: true }) })
            }
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.disclaimer}>
          {isVacation
            ? t('home.vacation_desc')
            : isGracePeriod
              ? t('home.grace_desc')
              : isPanicMode
                ? t('home.panic_active_desc')
                : t('home.active_desc')}
        </Text>
      </View>

      {/* Panic Confirmation Modal */}
      {isPanicMode && (
        <View style={panicModalVisible ? styles.modalOverlay : { display: 'none' }}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>{t('home.panic_modal_title')}</Text>
            <Text style={styles.modalText}>
              {t('home.panic_modal_desc')}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setPanicModalVisible(false)} style={[styles.modalBtn, styles.modalBtnCancel]}>
                <Text style={styles.modalBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmPanic} style={[styles.modalBtn, styles.modalBtnConfirm]}>
                <Text style={[styles.modalBtnText, { color: 'white' }]}>{t('home.panic_modal_button')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    paddingTop: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  statusBanner: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    overflow: 'hidden',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastConfirmed: {
    marginBottom: Spacing.xxl,
    color: Colors.textSecondary,
  },
  checkInButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  checkInInner: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  checkInText: {
    color: Colors.buttonText,
    fontSize: 16,
    fontWeight: '800',
  },
  checkInButtonDisabled: {
    borderColor: Colors.border,
    opacity: 0.8,
  },
  checkInInnerDisabled: {
    backgroundColor: Colors.surface,
    elevation: 0,
    shadowOpacity: 0,
  },
  nextCheckIn: {
    marginTop: Spacing.md,
  },
  footer: {
    paddingBottom: Spacing.xl,
  },
  disclaimer: {
    ...Typography.caption,
    textAlign: 'center',
    color: Colors.textSecondary,
    lineHeight: 18,
    paddingHorizontal: Spacing.xl,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalView: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    elevation: 10,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.escalated,
    marginBottom: Spacing.md,
  },
  modalText: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    backgroundColor: Colors.border,
  },
  modalBtnConfirm: {
    backgroundColor: Colors.escalated,
  },
  modalBtnText: {
    fontWeight: '700',
    fontSize: 16,
  },
  graceContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    backgroundColor: '#FFF7ED', // Light orange background
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.grace,
    width: '100%',
  },
  graceTitle: {
    ...Typography.h2,
    color: Colors.grace,
    fontSize: 20,
    marginBottom: Spacing.xs,
  },
  graceTimer: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.grace,
    fontVariant: ['tabular-nums'],
  }
});
