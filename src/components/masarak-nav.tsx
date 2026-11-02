import { usePathname, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, ui, createAdaptiveStyles} from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';
import { MasarakIcon, type IconName } from './masarak-icon';

const tabs = [
  { route: '/home', title: 'الرئيسية', icon: 'home' },
  { route: '/upload-cv', title: 'السيرة', icon: 'upload' },
  { route: '/careers', title: 'المسارات', icon: 'careers' },
  { route: '/career-chat', title: 'الدردشة', icon: 'chat' },
  { route: '/profile', title: 'ملفي', icon: 'profile' },
] as const;
export function MasarakNav() {
  const path = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useAppPreferences();
  const en = language === 'en';
  if (path === '/' || ['/onboarding', '/account', '/reset-password', '/auth-callback'].some(route => path === route || path.startsWith(`${route}/`)) || path.startsWith('/admin')) return null;
  const activeRoute = path === '/home' ? '/home'
    : ['/upload-cv', '/resume-preview', '/create-profile'].some(route => path === route || path.startsWith(`${route}/`)) ? '/upload-cv'
      : ['/careers', '/career', '/readiness', '/roadmap', '/learning-plan', '/course-details', '/progress', '/jobs', '/market'].some(route => path === route || path.startsWith(`${route}/`)) ? '/careers'
        : ['/career-chat', '/interview', '/interview-history'].some(route => path === route || path.startsWith(`${route}/`)) ? '/career-chat'
          : ['/profile', '/settings', '/privacy', '/delete-account'].some(route => path === route || path.startsWith(`${route}/`)) ? '/profile' : null;
  return <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
    <View style={[styles.tabs, en && styles.tabsLtr]}>{tabs.map(tab => {
      const active = activeRoute === tab.route;
      const title = en ? ({ '/home': 'Home', '/upload-cv': 'CV', '/careers': 'Paths', '/career-chat': 'Chat', '/profile': 'Profile' } as const)[tab.route] : tab.title;
      return <Pressable key={tab.route} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={title} onPress={() => { if (!active) router.replace(tab.route as never); }} style={({ pressed }) => [styles.tab, pressed && ui.pressed]}>
        <View style={[styles.icon, active && styles.active]}><MasarakIcon name={tab.icon as IconName} color={active ? colors.primary : colors.muted} size={21} /></View>
        <Text style={[styles.label, active && styles.activeLabel]}>{title}</Text>
      </Pressable>;
    })}</View>
  </View>;
}
const styles = createAdaptiveStyles(() => ({ container: { backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, paddingTop: 8 }, tabs: { width: '100%', maxWidth: 620, alignSelf: 'center', flexDirection: 'row-reverse' }, tabsLtr: { flexDirection: 'row' }, tab: { flex: 1, minHeight: 52, alignItems: 'center', gap: 3 }, icon: { borderRadius: 12, paddingHorizontal: 15, paddingVertical: 5 }, active: { backgroundColor: colors.mint }, label: { color: colors.muted, fontSize: 11 }, activeLabel: { color: colors.primary, fontWeight: '700' } }));
