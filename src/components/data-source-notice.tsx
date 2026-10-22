import { Text, View } from 'react-native';
import { ui } from '../constants/design';
export function DataSourceNotice() {
  return <View style={ui.card}>
    <Text style={ui.heading}>مصادر إرشادية وليست فرصًا حية</Text>
    <Text style={ui.note}>المسارات ومتطلباتها منتقاة من كتالوج محلي وقواعد إرشادية، وليست إعلانات وظائف أو ضمان توظيف. روابط التعلم تشير إلى مزودين خارجيين؛ راجع السعر واللغة والتوفر لديهم. لا توجد مزامنة تلقائية مع سوق وظائف أو تدريب.</Text>
    <Text style={[ui.note, { textAlign: 'left', writingDirection: 'ltr' }]}>Curated career and learning catalog, not live job vacancies or a hiring prediction. Verify availability and prices with the provider.</Text>
  </View>;
}
