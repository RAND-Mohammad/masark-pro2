import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../constants/design';

export type IconName = 'home' | 'careers' | 'plan' | 'profile' | 'upload' | 'arrow' | 'check' | 'lock' | 'mail' | 'education' | 'projects' | 'experience' | 'skills' | 'certificate' | 'course' | 'activity';
const paths: Partial<Record<IconName, string>> = {
  home: 'M3 10 12 3 21 10 M5 9v12h5v-7h4v7h5V9',
  careers: 'M4 21V11h4v10 M10 21V4h4v17 M16 21V8h4v13',
  plan: 'M8 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3 M8 3h8v4H8z M7 12h10 M7 17h6',
  upload: 'M12 16V3 M7 8l5-5 5 5 M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
  arrow: 'M19 12H5 M11 6l-6 6 6 6',
  check: 'M5 12l4 4 10-10',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3 M12 14v3',
  mail: 'M3 6l9 7 9-7',
  education: 'M2 9 12 4l10 5-10 5-10-5 M6 11.5V17c4 2.8 8 2.8 12 0v-5.5 M22 9v6',
  projects: 'M3 7h7l2 2h9v10H3z M3 7V5h7l2 2',
  experience: 'M3 8h18v12H3z M8 8V5h8v3 M3 12h18 M10 12v2h4v-2',
  skills: 'm14.5 6.5 3 3 M4 20l4.5-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.5 16z M13 8l3 3',
  certificate: 'M8 3h8l4 4v14H4V3z M8 3v5h8V3 M8 14l2.5 2.5L16 11',
  course: 'M3 5h18v14H3z M7 9h10 M7 13h7 M7 17h4',
  activity: 'M12 21s-8-4.4-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 6.6-8 11-8 11z',
};
export function MasarakIcon({ name, size = 23, color = colors.primary }: { name: IconName; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {name === 'profile' ? <><Circle cx="12" cy="7" r="4" /><Path d="M4 21v-2a8 8 0 0 1 16 0v2" /></> : <Path d={paths[name]} />}
    {name === 'lock' && <Rect x="4" y="10" width="16" height="12" rx="2" />}
    {name === 'mail' && <Rect x="3" y="5" width="18" height="14" rx="2" />}
  </Svg>;
}
