import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, ui } from '../constants/design';
import { MasarakIcon, type IconName } from './masarak-icon';

const tabs = [
  { route: '/home', title: 'الرئيسية', icon: 'home' },
  { route: '/careers', title: 'المسارات', icon: 'careers' },
  { route: '/learning-plan', title: 'خطتي', icon: 'plan' },
  { route: '/profile', title: 'ملفي', icon: 'profile' },
] as const;
export function MasarakNav() {
  const path = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  if (!tabs.some(tab => tab.route === path)) return null;
  return <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
    <View style={styles.tabs}>{tabs.map(tab => {
      const active = path === tab.route;
      return <Pressable key={tab.route} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={tab.title} onPress={() => { if (!active) router.replace(tab.route); }} style={({ pressed }) => [styles.tab, pressed && ui.pressed]}>
        <View style={[styles.icon, active && styles.active]}><MasarakIcon name={tab.icon as IconName} color={active ? colors.primary : colors.muted} size={21} /></View>
        <Text style={[styles.label, active && styles.activeLabel]}>{tab.title}</Text>
      </Pressable>;
    })}</View>
  </View>;
}
const styles = StyleSheet.create({ container: { backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, paddingTop: 8 }, tabs: { width: '100%', maxWidth: 620, alignSelf: 'center', flexDirection: 'row-reverse' }, tab: { flex: 1, minHeight: 52, alignItems: 'center', gap: 3 }, icon: { borderRadius: 12, paddingHorizontal: 15, paddingVertical: 5 }, active: { backgroundColor: colors.mint }, label: { color: colors.muted, fontSize: 11 }, activeLabel: { color: colors.primary, fontWeight: '700' } });
