import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export function authRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/auth-callback`;
  return Linking.createURL('/auth-callback');
}
