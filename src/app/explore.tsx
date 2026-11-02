import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, ui } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';

/** Keep the template's old /explore deep link inside the actual product flow. */
export default function ExploreRedirectScreen() {
  const router = useRouter();
  const { language } = useAppPreferences();
  useEffect(() => { router.replace('/careers'); }, [router]);
  return <SafeAreaView style={ui.screen}><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
    <ActivityIndicator color={colors.primary} />
    <Text style={ui.text}>{language === 'en' ? 'Opening career paths…' : 'جارٍ فتح المسارات المهنية…'}</Text>
  </View></SafeAreaView>;
}
