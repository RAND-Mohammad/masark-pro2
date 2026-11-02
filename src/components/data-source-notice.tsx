import { Text, View } from 'react-native';
import { ui } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';
export function DataSourceNotice() {
  const en = useAppPreferences().language === 'en';
  const ltr = en ? { textAlign: 'left' as const, writingDirection: 'ltr' as const } : undefined;
  return <View style={ui.card}>
    <Text style={[ui.heading, ltr]}>{en ? 'Guidance, not live vacancies' : 'مصادر إرشادية وليست فرصًا حية'}</Text>
    <Text style={[ui.note, ltr]}>{en ? 'Career paths and requirements come from a curated catalog and guidance rules. They are not job ads or a hiring guarantee. Learning links go to external providers; check their prices, language, and availability. Job and training listings do not sync automatically.' : 'المسارات ومتطلباتها منتقاة من كتالوج محلي وقواعد إرشادية، وليست إعلانات وظائف أو ضمان توظيف. روابط التعلم تشير إلى مزودين خارجيين؛ راجع السعر واللغة والتوفر لديهم. لا توجد مزامنة تلقائية مع سوق وظائف أو تدريب.'}</Text>
  </View>;
}
