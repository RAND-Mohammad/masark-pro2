import { Text, View } from 'react-native';
import { ui } from '../constants/design';
import type { PersonalProfile } from '../utils/personal-profile';
import type { SkillProfile } from '../utils/skill-profile';
import { studentResumeEducationLines } from '../utils/student-resume-education';

export function StudentResumePreview({ personal, skills }: { personal: PersonalProfile; skills: SkillProfile }) {
  const cv = skills.cv;
  const education = studentResumeEducationLines(personal, cv?.education ?? []);
  return <View style={ui.card}>
    <Text style={ui.heading}>معاينة الملف / السيرة الأولية</Text>
    <Text style={ui.title}>{personal.name || 'ملفي المهني'}</Text>
    {education.map((entry, i) => <Text key={`e${i}`} style={ui.text}>{entry}</Text>)}
    <Text style={ui.heading}>المهارات</Text>
    <Text style={ui.text}>{cv?.skills.map(s => s.name).join('، ') || 'لم تُضف مهارات نصية'}</Text>
    <Text style={ui.heading}>المشاريع</Text>
    {(cv?.projects ?? []).length ? cv?.projects?.map((p, i) => <View key={`p${i}`}>
      <Text style={ui.text}>{p.name}</Text><Text style={ui.note}>{p.description}</Text>
      {!!p.technologies?.length && <Text style={ui.note}>{p.technologies.join('، ')}</Text>}
    </View>) : <Text style={ui.note}>لم تُضف مشاريع؛ يمكن إكمال الملف دونها.</Text>}
    <Text style={ui.heading}>الدورات</Text>
    {(cv?.courses ?? []).length ? cv?.courses?.map((c, i) => <Text key={`c${i}`} style={ui.text}>{[c.name, c.issuer, c.date].filter(Boolean).join(' · ')}</Text>) : <Text style={ui.note}>لم تُضف دورات.</Text>}
    {!!cv?.certificates.length && <><Text style={ui.heading}>الشهادات الموجودة</Text>{cv.certificates.map((c, i) => <Text key={`cert${i}`} style={ui.text}>{[c.name, c.issuer].filter(Boolean).join(' · ')}</Text>)}</>}
    <Text style={ui.heading}>الخبرة (اختيارية)</Text>
    {cv?.experiences.length ? cv.experiences.map((e, i) => <View key={`x${i}`}><Text style={ui.text}>{[e.role, e.organization, e.dates].filter(Boolean).join(' · ')}</Text><Text style={ui.note}>{e.description}</Text></View>) : <Text style={ui.note}>لم تُضف خبرة عمل؛ هذا لا يمنع حفظ ملف الطالب.</Text>}
    {!!personal.interests.length && <><Text style={ui.heading}>الاهتمامات</Text><Text style={ui.text}>{personal.interests.join('، ')}</Text></>}
    <Text style={ui.note}>ملف أولي من بياناتك المعتمدة وإجاباتك، وليس سيرة مولّدة بالذكاء الاصطناعي أو مؤهلات متحققًا منها.</Text>
  </View>;
}
