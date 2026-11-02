import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PersonalBasicsForm } from '../components/personal-basics-form';
import { useAuth } from '../contexts/auth-context';
import { createAdaptiveStyles, ui } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';

export default function EditProfileScreen() {
  const router = useRouter();
  const auth = useAuth();
  const en = useAppPreferences().language === 'en';
  const text = (ar: string, english: string) => en ? english : ar;

  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/profile')}>
        <Text style={[ui.link, en && styles.ltr]}>{text('رجوع إلى ملفي', 'Back to my profile')}</Text>
      </Pressable>
      <Text style={[ui.eyebrow, en && styles.ltr]}>{text('ملفك المهني', 'YOUR PROFESSIONAL PROFILE')}</Text>
      <Text style={[ui.title, en && styles.ltr]}>{text('حافظي على تحديث ملفك.', 'Keep your story current.')}</Text>
      <Text style={[ui.text, en && styles.ltr]}>{text('يمكنك تعديل معلوماتك الشخصية والتعليمية متى تغيرت.', 'Update your personal and academic details whenever they change.')}</Text>
      <PersonalBasicsForm email={auth.session?.user.email} submitLabel={{ ar: 'حفظ التغييرات', en: 'Save changes' }} />
    </ScrollView>
  </SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({ ltr: { textAlign: 'left', writingDirection: 'ltr' } }));
