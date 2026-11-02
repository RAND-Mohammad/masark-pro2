import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MasarakIcon } from '../components/masarak-icon';
import { colors, ui, createAdaptiveStyles } from '../constants/design';
import { useAuth } from '../contexts/auth-context';
import { useAppPreferences } from '../contexts/app-preferences-context';
import { sendCareerChat, type CareerChatMessage } from '../utils/career-chat-api';

type ChatItem = CareerChatMessage & { id: number };
const STARTERS = {
  ar: ['وش المسار المناسب لي؟', 'وش أتعلم بعد؟', 'كيف أبني مشروع يثبت مهاراتي؟'],
  en: ['Which path could suit me?', 'What should I learn next?', 'How can I build a project that shows my skills?'],
};

export default function CareerChatScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const en = useAppPreferences().language === 'en';
  const language: 'ar' | 'en' = en ? 'en' : 'ar';
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nextId, setNextId] = useState(1);
  const scroll = useRef<ScrollViewInstance | null>(null);
  const turns = messages.filter(message => message.role === 'user').length;
  const text = (ar: string, english: string) => en ? english : ar;

  async function send(value = input) {
    const content = value.trim();
    if (!session || !consent || !content || content.length > 1600 || busy || turns >= 8) return;
    const userMessage: ChatItem = { id: nextId, role: 'user', content };
    const next = [...messages, userMessage];
    setNextId(id => id + 1); setMessages(next); setInput(''); setError(''); setBusy(true);
    try {
      const reply = await sendCareerChat(next.map(({ role, content: message }) => ({ role, content: message })), language, consent);
      setMessages(current => [...current, { id: nextId + 1, role: 'assistant', content: reply }]);
      setNextId(id => id + 2);
    } catch (failure) { setError(failure instanceof Error ? failure.message : text('تعذر الحصول على رد. أعيدي المحاولة.', 'Could not get a reply. Try again.')); }
    finally { setBusy(false); }
  }

  function clearChat() { if (!busy) { setMessages([]); setInput(''); setError(''); setNextId(1); } }

  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={[styles.header, en && styles.row]}>
          <Pressable accessibilityRole="button" accessibilityLabel={text('العودة', 'Back')} onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.back}><MasarakIcon name="arrow" /></Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, en && styles.ltr]}>{text('مساندة مهنية', 'CAREER SUPPORT')}</Text>
            <Text style={[ui.title, en && styles.ltr]}>{text('دردشة المسار المهني', 'Career chat')}</Text>
          </View>
          {messages.length > 0 ? <Pressable accessibilityRole="button" disabled={busy} onPress={clearChat} style={styles.clear}><Text style={[ui.link, en && styles.ltr]}>{text('محادثة جديدة', 'New chat')}</Text></Pressable> : null}
        </View>

        <View style={styles.scopeNote}><Text style={[ui.note, en && styles.ltr]}>{text('إرشاد مهني للتعلم والمسارات، وليس توقعًا للتوظيف أو مصدرًا لإعلانات الوظائف.', 'Guidance for learning and career paths, not a hiring prediction or a source of job listings.')}</Text></View>

        {!session ? <View style={styles.signInCard}>
          <Text style={[ui.heading, en && styles.ltr]}>{text('سجّلي الدخول لبدء الدردشة', 'Sign in to start chatting')}</Text>
          <Text style={[ui.text, en && styles.ltr]}>{text('تُستخدم المحادثة لتقديم إرشاد مهني، ولا تُحفظ في حسابك.', 'Your messages are used to provide career guidance and are not saved to your account.')}</Text>
          <Pressable accessibilityRole="button" style={ui.button} onPress={() => router.push({ pathname: '/account', params: { mode: 'login', redirect: '/career-chat' } })}><Text style={ui.buttonText}>{text('تسجيل الدخول', 'Sign in')}</Text></Pressable>
        </View> : <>
          <ScrollView ref={scroll} style={styles.messages} contentContainerStyle={styles.messageList} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
            {!messages.length ? <View style={styles.welcome}>
              <View style={styles.welcomeMark}><MasarakIcon name="careers" color={colors.primary} size={25} /></View>
              <Text style={[ui.heading, en && styles.ltr]}>{text('وش تبين تعرفين عن مسارك؟', 'What would you like to know about your career path?')}</Text>
              <Text style={[ui.note, en && styles.ltr]}>{text('اختاري سؤالًا مقترحًا أو اكتبي سؤالك. لا ترسلي معلومات شخصية أو بيانات تواصل.', 'Choose a prompt or write your question. Do not include personal identifiers or contact details.')}</Text>
              <View style={styles.starters}>{STARTERS[language].map(prompt => <Pressable key={prompt} accessibilityRole="button" disabled={busy} onPress={() => setInput(prompt)} style={[styles.starter, busy && styles.disabled]}><Text style={[styles.starterText, en && styles.ltr]}>{prompt}</Text></Pressable>)}</View>
            </View> : messages.map(message => <View key={message.id} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble, message.role === 'user' && en && styles.userBubbleEn]}>
              <Text style={[styles.bubbleLabel, en && styles.ltr]}>{message.role === 'user' ? text('أنتِ', 'You') : text('مرشد مسارك', 'Masarak guide')}</Text>
              <Text style={[styles.bubbleText, en && styles.ltr]}>{message.content}</Text>
            </View>)}
            {busy ? <View style={[styles.thinking, en && styles.row]}><ActivityIndicator color={colors.primary} /><Text style={[ui.note, en && styles.ltr]}>{text('يفكر في إجابة مناسبة…', 'Preparing a helpful reply…')}</Text></View> : null}
            {error ? <View style={styles.errorBox}><Text accessibilityRole="alert" style={[styles.errorText, en && styles.ltr]}>{error}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={() => { const last = [...messages].reverse().find(item => item.role === 'user'); if (last) { setMessages(current => current.filter(item => item.id !== last.id)); setInput(last.content); } setError(''); }}><Text style={[ui.link, en && styles.ltr]}>{text('تعديل السؤال وإعادة المحاولة', 'Edit the question and retry')}</Text></Pressable></View> : null}
            {messages.length > 0 && !busy ? <View style={[styles.nextActions, en && styles.row]}>
              <Pressable accessibilityRole="button" onPress={() => router.push('/careers')} style={styles.nextAction}><Text style={[styles.nextActionText, en && styles.ltr]}>{text('استكشاف المسارات', 'Explore paths')} →</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push('/learning-plan')} style={styles.nextAction}><Text style={[styles.nextActionText, en && styles.ltr]}>{text('فتح خطة التعلم', 'Open learning plan')} →</Text></Pressable>
            </View> : null}
          </ScrollView>

          <View style={styles.composer}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(value => !value)} disabled={busy} style={[styles.consent, en && styles.row]}>
              <View style={[styles.checkbox, consent && styles.checkboxOn]}><Text style={styles.checkMark}>{consent ? '✓' : ''}</Text></View>
              <Text style={[styles.consentText, en && styles.ltr]}>{text('أوافق على إرسال رسائلي في هذه المحادثة إلى Groq لتوليد الردود. لا يحفظ مسارك نص المحادثة.', 'I agree to send messages in this conversation to Groq to generate replies. Masarak does not save the chat text.')}</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://console.groq.com/docs/your-data')}><Text style={[ui.note, ui.link, en && styles.ltr]}>{text('سياسة استخدام بيانات Groq', 'Groq data use policy')}</Text></Pressable>
            <View style={[styles.inputRow, en && styles.row]}>
              <TextInput accessibilityLabel={text('اكتبي سؤالك المهني', 'Write your career question')} value={input} onChangeText={setInput} editable={!busy && turns < 8} multiline maxLength={1600} placeholder={text('اكتبي سؤالك هنا…', 'Write your question…')} placeholderTextColor={colors.muted} style={[styles.input, en && styles.ltr]} onSubmitEditing={() => void send()} />
              <Pressable accessibilityRole="button" accessibilityLabel={text('إرسال', 'Send')} disabled={busy || !consent || !input.trim() || turns >= 8} onPress={() => void send()} style={[styles.send, (busy || !consent || !input.trim() || turns >= 8) && styles.disabled]}>
                {busy ? <ActivityIndicator color={colors.onPrimary} /> : <MasarakIcon name="arrow" color={colors.onPrimary} size={20} />}
              </Pressable>
            </View>
            <Text style={[ui.note, styles.turnCount, en && styles.ltr]}>{text(`باقي ${Math.max(8 - turns, 0)} رسائل في هذه المحادثة`, `${Math.max(8 - turns, 0)} messages left in this chat`)}</Text>
          </View>
        </>}
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 10, gap: 12 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, minHeight: 58 }, row: { flexDirection: 'row' },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: 2 }, eyebrow: { color: colors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1, textAlign: 'right' },
  clear: { paddingHorizontal: 3 }, ltr: { textAlign: 'left', writingDirection: 'ltr' },
  scopeNote: { backgroundColor: colors.mint, padding: 12, borderRadius: 12 },
  signInCard: { backgroundColor: colors.surface, padding: 19, borderRadius: 19, borderWidth: 1, borderColor: colors.border, gap: 13 },
  messages: { flex: 1 }, messageList: { flexGrow: 1, gap: 11, paddingVertical: 7 },
  welcome: { flex: 1, minHeight: 250, alignItems: 'stretch', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12 },
  welcomeMark: { width: 47, height: 47, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint },
  starters: { gap: 8, paddingTop: 3 }, starter: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 13, padding: 11 }, starterText: { color: colors.primary, fontSize: 14, lineHeight: 21, textAlign: 'right', fontWeight: '600' },
  bubble: { maxWidth: '88%', padding: 13, borderRadius: 16, gap: 5 }, userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 5 }, userBubbleEn: { alignSelf: 'flex-start', borderBottomRightRadius: 16, borderBottomLeftRadius: 5 }, assistantBubble: { alignSelf: 'stretch', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomRightRadius: 5 },
  bubbleLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'right' }, bubbleText: { color: colors.ink, fontSize: 15, lineHeight: 24, textAlign: 'right' },
  thinking: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, padding: 10 },
  errorBox: { backgroundColor: colors.errorSurface, borderRadius: 12, borderWidth: 1, borderColor: colors.errorBorder, padding: 12, gap: 4 }, errorText: { color: colors.error, fontSize: 14, lineHeight: 21, textAlign: 'right' },
  nextActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }, nextAction: { borderRadius: 12, backgroundColor: colors.mint, paddingVertical: 9, paddingHorizontal: 12 }, nextActionText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  composer: { backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, paddingTop: 10, paddingBottom: 7, gap: 7 },
  consent: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 9 }, checkbox: { width: 21, height: 21, borderWidth: 1.5, borderRadius: 6, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 }, checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary }, checkMark: { color: colors.onPrimary, fontSize: 13, fontWeight: '800' }, consentText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'right' },
  inputRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 8 }, input: { flex: 1, minHeight: 44, maxHeight: 105, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: colors.ink, textAlign: 'right', writingDirection: 'rtl', fontSize: 15 }, send: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.48 }, turnCount: { textAlign: 'center', fontSize: 10 },
}));
