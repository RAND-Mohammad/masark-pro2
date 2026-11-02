import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

const palettes = {
  light: {
    background: '#F8F9F5', surface: '#FFFFFF', ink: '#193C3B', navy: '#172D49', contrastPanel: '#10294B', contrastOnPanel: '#FFFFFF', contrastAccent: '#5AD8C2',
    primary: '#12635E', mint: '#E6F0EB', soft: '#F0F4F0', muted: '#617570',
    border: '#DDE6E0', gold: '#B49B5D', error: '#A33535', onPrimary: '#FFFFFF',
    warningSurface: '#FAF4E8', warningBorder: '#E9D8B9', errorSurface: '#FFF0ED', errorBorder: '#F0D8CF', track: '#E2E8E3', successSurface: '#E5F3EE',
  },
  dark: {
    background: '#101817', surface: '#192321', ink: '#E5F0EB', navy: '#D5E2EF', contrastPanel: '#13233A', contrastOnPanel: '#F4F8FF', contrastAccent: '#69E0CB',
    primary: '#70C5B9', mint: '#243A35', soft: '#202D29', muted: '#A7B8B1',
    border: '#354640', gold: '#D8BE7E', error: '#F09188', onPrimary: '#102522',
    warningSurface: '#3B3220', warningBorder: '#655735', errorSurface: '#3A2523', errorBorder: '#67403B', track: '#33423D', successSurface: '#203B34',
  },
} as const;

export type DesignScheme = keyof typeof palettes;
type Palette = typeof palettes.light;
let activeScheme: DesignScheme = 'light';

export function setDesignScheme(scheme: DesignScheme) { activeScheme = scheme; }
export function getDesignScheme() { return activeScheme; }

export const colors = new Proxy({} as Palette, {
  get: (_target, key: string | symbol) => typeof key === 'string' && key in palettes[activeScheme]
    ? palettes[activeScheme][key as keyof Palette]
    : undefined,
});

type AdaptiveStyleMap<T> = { [K in keyof T]: ViewStyle | TextStyle | ImageStyle };
export function createAdaptiveStyles<T extends AdaptiveStyleMap<T>>(factory: () => T): T {
  const cache: Partial<Record<DesignScheme, T>> = {};
  return new Proxy({} as T, {
    get: (_target, key: string | symbol) => {
      const scheme = activeScheme;
      const styles = cache[scheme] ?? (cache[scheme] = StyleSheet.create(factory()) as T);
      return Reflect.get(styles, key);
    },
  });
}

export const ui = createAdaptiveStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 24, paddingBottom: 32, gap: 22 },
  card: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 14 },
  title: { color: colors.ink, fontSize: 28, lineHeight: 40, fontWeight: '700', textAlign: 'right' as const },
  heading: { color: colors.ink, fontSize: 20, lineHeight: 30, fontWeight: '600', textAlign: 'right' as const },
  text: { color: colors.muted, fontSize: 15, lineHeight: 25, textAlign: 'right' as const },
  note: { color: colors.muted, fontSize: 12, lineHeight: 21, textAlign: 'right' as const },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5, textAlign: 'right' as const },
  button: { backgroundColor: colors.primary, borderRadius: 15, minHeight: 52, padding: 16, alignItems: 'center' as const, justifyContent: 'center' as const },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600', textAlign: 'center' as const },
  outline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: 15, minHeight: 52, padding: 16, alignItems: 'center' as const, justifyContent: 'center' as const },
  outlineText: { color: colors.primary, fontSize: 16, fontWeight: '600', textAlign: 'center' as const },
  link: { color: colors.primary, fontSize: 15, lineHeight: 24, paddingVertical: 10, textAlign: 'right' as const },
  input: { color: colors.ink, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 14, minHeight: 52, fontSize: 16, textAlign: 'right' as const },
  row: { flexDirection: 'row-reverse' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12 },
  pressed: { opacity: 0.72 },
}));
