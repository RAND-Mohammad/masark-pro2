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
    <Text style={ui.text}>خادم التحليل يستقبل PDF بعد التحقق من الجلسة ويقرأ النص في الذاكرة. بعد موافقتك يرسل ملف PDF ونصه إلى Google Gemini، ثم يطابق أدلة النتيجة مع النص المقروء. عند غياب المفتاح أو تعذر النموذج يظهر خطأ دون تحليل محلي بديل. وفق خطة Google المجانية، قد تُستخدم بيانات الطلب لتحسين منتجاتها؛ استخدم سيرة وهمية أو منقحة للاختبار، وراجع خطة المفتاح قبل إرسال بيانات حقيقية. تدريب المقابلة منفصل: محلي افتراضيًا، وإرسال الإجابة إلى Groq يحتاج موافقة مستقلة.</Text>
    <Text style={ui.heading}>المراجعة والحذف</Text>
    <Text style={ui.text}>يمكن تعديل بياناتك وحذف السيرة ونتائج المقابلات من واجهاتها؛ المزامنة المفعلة تنقل التغيير للحساب. إزالة مستند السيرة لا تمحو المهارات التي سبق اعتمادها؛ راجعها في ملف المهارات. سجل التدريب محدود بـ100 نتيجة ولا يحذف الأقدم تلقائيًا. حذف الحساب الكامل وجميع النسخ ليس متاحًا من الواجهة بعد، ويجب استكماله والتحقق من سياسة الاحتفاظ قبل الإطلاق العام.</Text>
    <Text style={ui.heading}>Privacy summary</Text>
    <Text style={[ui.text, { textAlign: 'left', writingDirection: 'ltr' }]}>Guest data stays on the device. Account cloud backup is opt-in and uses Supabase PostgreSQL and private file storage. After explicit consent, the server sends the PDF and extracted text to Google Gemini for resume analysis; results are checked against the extracted text and still need user review. Google may use free-tier prompts to improve its products, so use a synthetic or redacted resume for testing. Interview AI is separate and requires its own consent. Scores are not hiring guarantees. Full account erasure and a finalized retention policy remain release requirements. This notice describes the implementation, not a finalized legal privacy policy.</Text>
  </ScrollView></SafeAreaView>;
}
