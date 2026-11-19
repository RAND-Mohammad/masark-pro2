import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export function authRedirectUrl() {
  if (Platform.OS === 'web') {
    const stableWebOrigin = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim().replace(/\/+$/, '');
    if (stableWebOrigin) return `${stableWebOrigin}/auth-callback`;
    if (typeof window !== 'undefined') return `${window.location.origin}/auth-callback`;
  }
  return Linking.createURL('/auth-callback');
}
