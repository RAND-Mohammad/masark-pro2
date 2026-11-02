import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, createAdaptiveStyles} from '../constants/design';

type Props = {
  title: string;
  subtitle?: string;
  summary?: string;
  status?: string;
  statusTone?: 'neutral' | 'success' | 'warning';
  actionLabel?: string;
  onAction?: () => void;
  defaultExpanded?: boolean;
  children: ReactNode;
};

export function DisclosureCard({ title, subtitle, summary, status, statusTone = 'neutral', actionLabel, onAction, defaultExpanded = false, children }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const en = !/[\u0600-\u06FF]/.test(`${title} ${subtitle ?? ''} ${summary ?? ''}`);
  const row = en ? { flexDirection: 'row' as const } : undefined;
  const textDirection = en ? { textAlign: 'left' as const, writingDirection: 'ltr' as const } : undefined;

  return <View style={styles.card}>
    <View style={[styles.headerRow, row]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={en ? `${title}${status ? `, status: ${status}` : ''}${summary ? `, ${summary.slice(0, 120)}` : ''}, ${expanded ? 'hide details' : 'show details'}` : `${title}${status ? `، الحالة: ${status}` : ''}${summary ? `، ${summary.slice(0, 120)}` : ''}، ${expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}`}
        accessibilityHint={en ? 'Opens or closes this section' : 'يفتح أو يغلق تفاصيل هذا القسم'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(value => !value)}
        style={({ pressed }) => [styles.header, row, pressed && styles.pressed]}
      >
        <View style={styles.copy}>
          <View style={[styles.titleRow, row]}>
            <Text style={[styles.title, textDirection]}>{title}</Text>
            <Text style={[styles.chevron, expanded && styles.chevronOpen]}>{expanded ? '⌃' : '⌄'}</Text>
          </View>
          {subtitle ? <Text style={[styles.subtitle, textDirection]}>{subtitle}</Text> : null}
          {summary ? <Text style={[styles.summary, textDirection]} numberOfLines={2}>{summary}</Text> : null}
        </View>
        {status ? <View style={[styles.status, statusTone === 'success' && styles.statusSuccess, statusTone === 'warning' && styles.statusWarning]}><Text style={[styles.statusText, statusTone === 'success' && styles.statusTextSuccess, statusTone === 'warning' && styles.statusTextWarning]}>{status}</Text></View> : null}
      </Pressable>
      {actionLabel && onAction ? <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel} ${title}`}
        onPress={() => { setExpanded(true); onAction(); }}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      ><Text style={styles.actionText}>{actionLabel}</Text></Pressable> : null}
    </View>
    {expanded ? <View style={styles.body}>{children}</View> : null}
  </View>;
}

const styles = createAdaptiveStyles(() => ({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, overflow: 'hidden' },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, padding: 16 },
  header: { flex: 1, minHeight: 52, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  copy: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  title: { color: colors.ink, fontSize: 18, lineHeight: 27, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  chevron: { color: colors.muted, fontSize: 22, lineHeight: 26 },
  chevronOpen: { color: colors.primary },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  summary: { color: colors.ink, fontSize: 14, lineHeight: 22, textAlign: 'right' },
  status: { borderRadius: 999, backgroundColor: colors.soft, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 120 },
  statusSuccess: { backgroundColor: colors.mint },
  statusWarning: { backgroundColor: colors.warningSurface },
  statusText: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
  statusTextSuccess: { color: colors.primary },
  statusTextWarning: { color: colors.gold },
  action: { minHeight: 44, minWidth: 68, borderRadius: 13, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  actionText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  body: { borderTopWidth: 1, borderTopColor: colors.border, padding: 16, gap: 12 },
  pressed: { opacity: 0.68 },
}));
