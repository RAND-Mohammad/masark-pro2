import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { AppLanguage } from '../contexts/app-preferences-context';

const STORAGE_KEY = 'masarak-learning-reminder-enabled-v1';
const FEATURE_KEY = 'masarakFeature';
const FEATURE_VALUE = 'learning-reminder';
const CHANNEL_ID = 'learning-reminders';

export class LearningReminderError extends Error {
  constructor(readonly code: 'unsupported' | 'permission-denied' | 'schedule-failed') {
    super(code);
    this.name = 'LearningReminderError';
  }
}

export async function readLearningReminderEnabled() {
  if (Platform.OS === 'web') return false;
  const enabled = await AsyncStorage.getItem(STORAGE_KEY);
  if (enabled !== 'true') return false;
  const Notifications = await import('expo-notifications');
  if (!(await Notifications.getPermissionsAsync()).granted) return false;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some(item => item.content.data?.[FEATURE_KEY] === FEATURE_VALUE);
}

export async function setLearningReminderEnabled(enabled: boolean, language: AppLanguage) {
  if (Platform.OS === 'web') throw new LearningReminderError('unsupported');
  const Notifications = await import('expo-notifications');
  const { AndroidImportance, SchedulableTriggerInputTypes } = Notifications;

  if (enabled) {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: language === 'ar' ? 'تذكيرات التعلم' : 'Learning reminders',
        importance: AndroidImportance.DEFAULT,
        vibrationPattern: [0, 180, 120, 180],
        lightColor: '#14776F',
      });
    }

    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) throw new LearningReminderError('permission-denied');
  }

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing
    .filter(item => item.content.data?.[FEATURE_KEY] === FEATURE_VALUE)
    .map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)));

  if (enabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: language === 'ar' ? 'حان وقت خطوة تعلم جديدة' : 'Time for your next learning step',
        body: language === 'ar' ? 'افتحي مسارك وواصلي التقدم، خطوة واحدة تكفي.' : 'Open Masarak and keep going. One small step is enough.',
        data: { [FEATURE_KEY]: FEATURE_VALUE },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DAILY,
        hour: 19,
        minute: 0,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
  }

  await AsyncStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  return enabled;
}
