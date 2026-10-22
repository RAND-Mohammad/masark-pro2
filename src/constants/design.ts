import { StyleSheet } from 'react-native';

export const colors = {
  background: '#F8F9F5', surface: '#FFFFFF', ink: '#193C3B', navy: '#172D49',
  primary: '#12635E', mint: '#E6F0EB', soft: '#F0F4F0', muted: '#617570',
  border: '#DDE6E0', gold: '#B49B5D', error: '#A33535',
};

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 24, paddingBottom: 32, gap: 22 },
  card: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 14 },
  title: { color: colors.ink, fontSize: 28, lineHeight: 40, fontWeight: '700', textAlign: 'right' },
  heading: { color: colors.ink, fontSize: 20, lineHeight: 30, fontWeight: '600', textAlign: 'right' },
  text: { color: colors.muted, fontSize: 15, lineHeight: 25, textAlign: 'right' },
  note: { color: colors.muted, fontSize: 12, lineHeight: 21, textAlign: 'right' },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5, textAlign: 'right' },
  button: { backgroundColor: colors.primary, borderRadius: 15, minHeight: 52, padding: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  outline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: 15, minHeight: 52, padding: 16, alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: colors.primary, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  link: { color: colors.primary, fontSize: 15, lineHeight: 24, paddingVertical: 10, textAlign: 'right' },
  input: { color: colors.ink, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 14, minHeight: 52, fontSize: 16, textAlign: 'right' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pressed: { opacity: 0.72 },
});
