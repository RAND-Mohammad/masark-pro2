import { Text, View } from 'react-native';
import { ui } from '../constants/design';
import type { PersonalProfile } from '../utils/personal-profile';
import type { SkillProfile } from '../utils/skill-profile';
import { studentResumeEducationLines } from '../utils/student-resume-education';
import { useAppPreferences } from '../contexts/app-preferences-context';

export function StudentResumePreview({ personal, skills }: { personal: PersonalProfile; skills: SkillProfile }) {
  const { language } = useAppPreferences();
  const en = language === 'en';
  const ltr = en ? { textAlign: 'left' as const, writingDirection: 'ltr' as const } : undefined;
  const cv = skills.cv;
  const education = studentResumeEducationLines(personal, cv?.education ?? []);
  return <View style={ui.card}>
    <Text style={[ui.heading, ltr]}>{en ? 'Profile preview / starter CV' : 'معاينة الملف / السيرة الأولية'}</Text>
    <Text style={[ui.title, ltr]}>{personal.name || (en ? 'My professional profile' : 'ملفي المهني')}</Text>
    {education.map((entry, i) => <Text key={`e${i}`} style={[ui.text, ltr]}>{entry}</Text>)}
    <Text style={[ui.heading, ltr]}>{en ? 'Skills' : 'المهارات'}</Text>
    <Text style={[ui.text, ltr]}>{cv?.skills.map(s => s.name).join(en ? ', ' : '، ') || (en ? 'No text skills added' : 'لم تُضف مهارات نصية')}</Text>
    <Text style={[ui.heading, ltr]}>{en ? 'Projects' : 'المشاريع'}</Text>
    {(cv?.projects ?? []).length ? cv?.projects?.map((p, i) => <View key={`p${i}`}>
      <Text style={[ui.text, ltr]}>{p.name}</Text><Text style={[ui.note, ltr]}>{p.description}</Text>
      {!!p.technologies?.length && <Text style={[ui.note, ltr]}>{p.technologies.join(en ? ', ' : '، ')}</Text>}
    </View>) : <Text style={[ui.note, ltr]}>{en ? 'No projects added. You can finish your profile without them.' : 'لم تُضف مشاريع؛ يمكن إكمال الملف دونها.'}</Text>}
    <Text style={[ui.heading, ltr]}>{en ? 'Courses' : 'الدورات'}</Text>
    {(cv?.courses ?? []).length ? cv?.courses?.map((c, i) => <Text key={`c${i}`} style={[ui.text, ltr]}>{[c.name, c.issuer, c.date].filter(Boolean).join(' · ')}</Text>) : <Text style={[ui.note, ltr]}>{en ? 'No courses added.' : 'لم تُضف دورات.'}</Text>}
    {!!cv?.certificates.length && <><Text style={[ui.heading, ltr]}>{en ? 'Certificates on file' : 'الشهادات الموجودة'}</Text>{cv.certificates.map((c, i) => <Text key={`cert${i}`} style={[ui.text, ltr]}>{[c.name, c.issuer].filter(Boolean).join(' · ')}</Text>)}</>}
    <Text style={[ui.heading, ltr]}>{en ? 'Experience (optional)' : 'الخبرة (اختيارية)'}</Text>
    {cv?.experiences.length ? cv.experiences.map((e, i) => <View key={`x${i}`}><Text style={[ui.text, ltr]}>{[e.role, e.organization, e.dates].filter(Boolean).join(' · ')}</Text><Text style={[ui.note, ltr]}>{e.description}</Text></View>) : <Text style={[ui.note, ltr]}>{en ? 'No work experience added. This does not prevent saving your profile.' : 'لم تُضف خبرة عمل؛ هذا لا يمنع حفظ ملف الطالب.'}</Text>}
    {!!personal.interests.length && <><Text style={[ui.heading, ltr]}>{en ? 'Interests' : 'الاهتمامات'}</Text><Text style={[ui.text, ltr]}>{personal.interests.join(en ? ', ' : '، ')}</Text></>}
    <Text style={[ui.note, ltr]}>{en ? 'A starter profile based on your confirmed information and answers. It is not an AI-generated CV or a verification of qualifications.' : 'ملف أولي من بياناتك المعتمدة وإجاباتك، وليس سيرة مولّدة بالذكاء الاصطناعي أو مؤهلات متحققًا منها.'}</Text>
  </View>;
}
