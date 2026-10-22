import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ui } from '../constants/design';
export default function PrivacyScreen() {
  const router = useRouter();
  return <SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/profile')}><Text style={ui.link}>العودة / Back</Text></Pressable>
    <Text style={ui.title}>بياناتك في مسارك</Text>
    <Text style={ui.heading}>على الجهاز والحساب</Text>
    <Text style={ui.text}>بيانات الضيف محلية. بيانات الحساب مفصولة عنه وعن الحسابات الأخرى. تسجيل الخروج لا يحذف الملفات من الجهاز. جلسة الهاتف محفوظة في التخزين الآمن؛ بيانات الملف والسيرة نفسها ليست مشفرة بتشفير خاص بالتطبيق على الجهاز.</Text>
    <Text style={ui.heading}>الحفظ السحابي اختياري وحقيقي</Text>
    <Text style={ui.text}>عند تفعيله، يرسل التطبيق الملف المهني وخطة التعلم ونتائج السيرة والمقابلات إلى قاعدة Supabase، ويحفظ PDF في مخزن خاص بالحساب. إيقاف المزامنة لا يحذف النسخة السحابية. راجع حالة المزامنة ولا تفترض نجاح الحفظ عند وجود خطأ.</Text>
    <Text style={ui.heading}>التحليل والمزود الخارجي</Text>
    <Text style={ui.text}>خادم التحليل يستقبل PDF بعد التحقق من الجلسة ويقرأ النص في الذاكرة. بعد موافقتك يرسل ملف PDF ونصه إلى Google Gemini، ويطابق أدلة النتيجة مع النص المقروء. عند غياب المفتاح أو تعذر النموذج يظهر خطأ، دون تحليل محلي بديل. يخضع التعامل لدى المزود لشروط Gemini وخطة مشروع Google؛ راجع شروطه قبل رفع معلومات حساسة. تدريب المقابلة باقٍ كما هو: محلي افتراضيًا، وإرسال الإجابة إلى Groq يحتاج موافقة منفصلة. لا تضع بيانات حساسة في إجابة التدريب.</Text>
    <Text style={ui.heading}>المراجعة والحذف</Text>
    <Text style={ui.text}>يمكن تعديل بياناتك وحذف السيرة ونتائج المقابلات من واجهاتها؛ المزامنة المفعلة تنقل التغيير للحساب. إزالة مستند السيرة لا تمحو المهارات التي سبق اعتمادها؛ راجعها في ملف المهارات. سجل التدريب محدود بـ100 نتيجة ولا يحذف الأقدم تلقائيًا. حذف الحساب الكامل وجميع النسخ ليس متاحًا من الواجهة بعد، ويجب استكماله والتحقق من سياسة الاحتفاظ قبل الإطلاق العام.</Text>
    <Text style={ui.heading}>Privacy summary</Text>
    <Text style={[ui.text, { textAlign: 'left', writingDirection: 'ltr' }]}>Guest data stays on the device. Account cloud backup is opt-in and uses Supabase PostgreSQL and private file storage. Signing out or pausing sync does not erase stored data. Local analysis is rule-based; configured AI receives resume text only after the analysis consent, and interview AI requires a separate opt-in. Review results; scores are not hiring guarantees. Full account erasure and a finalized operator retention policy remain release requirements. This notice describes the implementation, not a finalized legal privacy policy.</Text>
  </ScrollView></SafeAreaView>;
}
