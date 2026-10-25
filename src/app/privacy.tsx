import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ui } from '../constants/design';
export default function PrivacyScreen() {
  const router = useRouter();
  return <SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/profile')}><Text style={ui.link}>العودة / Back</Text></Pressable>
    <Text style={ui.title}>بياناتك في مسارك</Text>
    <Text style={ui.heading}>على الجهاز والحساب</Text>
    <Text style={ui.text}>بيانات الضيف محلية. بيانات الحساب مفصولة عنه وعن الحسابات الأخرى. تسجيل الخروج لا يحذف الملفات من الجهاز. جلسة الهاتف محفوظة في التخزين الآمن؛ بيانات الملف والسيرة نفسها ليست مشفرة بتشفير خاص بالتطبيق على الجهاز.</Text>
    <Text style={ui.heading}>الحفظ التلقائي للحساب</Text>
    <Text style={ui.text}>بعد تسجيل الدخول أو استعادة الجلسة تُسترجع بيانات الحساب قبل مزامنة التغييرات تلقائياً. تبقى بيانات الضيف محلية ولا تُرفع أو تُدمج تلقائياً. يُحفظ الملف المهني وخطة التعلم ونتائج السيرة والمقابلات في Supabase وملف PDF في مخزن خاص بالحساب. عند انقطاع الشبكة تبقى التغييرات محلياً للحساب وتُعاد محاولة المزامنة تلقائياً. تسجيل الخروج لا يحذف النسخة السحابية. لا تظهر حالة «تم الحفظ» إلا بعد تأكيد النجاح.</Text>
    <Text style={ui.heading}>التحليل والمزود الخارجي</Text>
    <Text style={ui.text}>يقرأ الخادم نص PDF في الذاكرة بعد التحقق من الجلسة، ثم يرسل النص المستخرج إلى Groq بعد موافقتك. يراجع الخادم الأدلة قبل عرض النتيجة، وتحتاج النتيجة مراجعتك. لا تُحتفظ طلبات الاستدلال لدى Groq افتراضيًا؛ قد تُسجل مؤقتًا لأسباب موثوقية الخدمة أو إساءة الاستخدام حتى 30 يومًا، ولا تُستخدم لتدريب نماذج Groq وفق وثائقها. استخدم سيرة تجريبية أو منقحة للاختبار. عند غياب المفتاح أو تعذر الخدمة يظهر خطأ دون نتيجة بديلة. تقييم المقابلة منفصل ويحتاج موافقة مستقلة.</Text>
    <Text style={ui.heading}>المراجعة والحذف</Text>
    <Text style={ui.text}>يمكن تعديل بياناتك وحذف السيرة ونتائج المقابلات من واجهاتها؛ المزامنة المفعلة تنقل التغيير للحساب. إزالة مستند السيرة لا تمحو المهارات التي سبق اعتمادها؛ راجعها في ملف المهارات. سجل التدريب محدود بـ100 نتيجة ولا يحذف الأقدم تلقائيًا. حذف الحساب الكامل وجميع النسخ ليس متاحًا من الواجهة بعد، ويجب استكماله والتحقق من سياسة الاحتفاظ قبل الإطلاق العام.</Text>
    <Text style={ui.heading}>Privacy summary</Text>
    <Text style={[ui.text, { textAlign: 'left', writingDirection: 'ltr' }]}>Guest data stays on the device. Account saving is automatic after sign-in or session restoration, restores existing cloud data before uploads, never merges guest data, and uses Supabase PostgreSQL and private file storage. After explicit consent, the server extracts text from the PDF and sends that text to Groq for resume analysis. Groq says inference data is not retained by default and is not used to train its models; limited reliability or abuse logs may be retained for up to 30 days. Analysis evidence is checked against the extracted text and still needs user review. Use a synthetic or redacted resume for testing. Interview AI is separate and requires its own consent. Scores are not hiring guarantees. Full account erasure and a finalized retention policy remain release requirements. This notice describes the implementation, not a finalized legal privacy policy.</Text>
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://console.groq.com/docs/your-data')}><Text style={ui.link}>Groq data practices</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
