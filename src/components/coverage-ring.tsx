import Svg, { Circle } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/design';

export function CoverageRing({ score }: { score: number | null }) {
  const radius = 41;
  const length = 2 * Math.PI * radius;
  return <View style={styles.ring} accessible={false}>
    <Svg width="104" height="104" viewBox="0 0 104 104">
      <Circle cx="52" cy="52" r={radius} fill="none" stroke="#CEDFD6" strokeWidth="7" />
      <Circle cx="52" cy="52" r={radius} fill="none" stroke={colors.primary} strokeWidth="7" strokeDasharray={`${length} ${length}`} strokeDashoffset={length * (1 - (score ?? 0) / 100)} strokeLinecap="round" transform="rotate(-90 52 52)" />
    </Svg>
    <Text style={styles.symbol}>{score === null ? '↗' : `${score}%`}</Text>
  </View>;
}
const styles = StyleSheet.create({ ring: { width: 104, height: 104, justifyContent: 'center', alignItems: 'center' }, symbol: { position: 'absolute', color: colors.primary, fontWeight: '600', fontSize: 23 } });
