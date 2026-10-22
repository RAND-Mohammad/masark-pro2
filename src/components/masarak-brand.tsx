import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors } from '../constants/design';

export function MasarakBrand({ large = false }: { large?: boolean }) {
  return <View accessibilityLabel="مسارك" style={styles.brand}>
    <Svg width={large ? 110 : 54} height={large ? 76 : 38} viewBox="0 0 110 76">
      <Path d="M10 61 C28 39 35 72 54 52 C64 42 66 28 72 21" stroke={colors.navy} strokeWidth="6" strokeLinecap="round" fill="none" />
      {Array.from({ length: 14 }, (_, i) => {
        const angle = i * Math.PI * 2 / 14;
        const x = 77 + Math.cos(angle) * 19;
        const y = 22 + Math.sin(angle) * 19;
        return <ViewSeed key={i} x={x} y={y} />;
      })}
      <Circle cx="77" cy="22" r="3" fill={colors.primary} />
    </Svg>
    <Text style={[styles.name, large && styles.large]}>MASARAK</Text>
    {large && <Text style={styles.tagline}>YOUR AI CAREER COMPANION</Text>}
  </View>;
}
function ViewSeed({ x, y }: { x: number; y: number }) {
  return <><Line x1="77" y1="22" x2={x} y2={y} stroke="#88BDA3" strokeWidth="0.8" /><Circle cx={x} cy={y} r="2.1" fill="#539D7D" /></>;
}
const styles = StyleSheet.create({
  brand: { alignItems: 'center', alignSelf: 'center' },
  name: { color: colors.navy, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  large: { fontSize: 23, letterSpacing: 2 },
  tagline: { color: colors.muted, fontSize: 8, letterSpacing: 1.6, marginTop: 10 },
});
