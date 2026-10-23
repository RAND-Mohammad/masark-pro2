import { normalizeSkillName } from '../src/utils/skill-matching.mjs';
import { academicFact, combinedEducationFacts, inferStudyStatus, isDescription, literalMajor, plausibleEducationField } from './resume-field-rules.mjs';
import { CV_PARSER_VERSION } from '../src/utils/cv-parser-version.mjs';

const headings = {
  skills: /^(?:skills|technical skills|core competencies|core technical competencies|technical competencies|key skills|skills and abilities|skills\s*&\s*tools|tools\s*(?:and|&)\s*technologies|technologies\s*(?:and|&)\s*tools|skill set|technical skill set|المهارات|المهارات التقنية|المهارات والقدرات)$/iu,
  projects: /^(?:projects?|selected projects?|project experience|labs?\s*(?:and|&)\s*projects?|projects?\s*(?:and|&)\s*labs?|academic\s*(?:and|&)\s*applied\s+projects?|(?:personal|academic|graduation|capstone|final[- ]year)\s+projects?|المشاريع|مشاريع|المشروعات|المشاريع التقنية|المشاريع الأكاديمية|المشروعات الأكاديمية|مشروع التخرج|مشاريع التخرج)$/iu,
  courses: /^(?:courses?|training courses|professional development|training|الدورات|الدورات التدريبية|الدورات المهنية|دورات)$/iu,
  certificates: /^(?:certificates?|certifications?|professional certifications?|الشهادات|الشهادات المهنية)$/iu,
  unclassified: /^(?:courses?\s*(?:and|&|\/)\s*certifications?|courses?\s*(?:and|&|\/)\s*certificates?|certifications?\s*(?:and|&)\s*professional training|professional training\s*(?:and|&)\s*certifications?|certifications?\s*(?:and|&|\/)\s*courses?|الدورات\s*(?:و|\/)\s*الشهادات|الشهادات\s*(?:و|\/)\s*الدورات)$/iu,
  education: /^(?:education|educational background|education\s*(?:and|&|\/)\s*qualifications|academic background|academic qualifications|academics|التعليم|الدراسة|الخلفية الأكاديمية|التعليم الأكاديمي|المؤهلات|المؤهلات الأكاديمية|المؤهلات العلمية|التعليم\s*و\s*المؤهلات(?: العلمية)?|المؤهل العلمي)$/iu,
  experiences: /^(?:experience|work experience|professional experience|work history|career history|employment history|internship experience|internships?|training experience|work[- ]based training|on[- ]the[- ]job training|training placement|work placement|co[- ]?op training|practicum|الخبرة|الخبرات|الخبرات العملية|الخبرة العملية|خبرات العمل|الخبرات المهنية|التدريب|التدريب العملي|التدريب الميداني|التدريب التعاوني|التدريب الوظيفي)$/iu,
  activities: /^(?:activities|volunteering|volunteer|الأنشطة|التطوع)$/iu,
  stop: /^(?:summary|professional summary|profile|objective|career objective|contact|contact information|personal information|references|awards|languages|activities\s*(?:and|&)\s*languages?|نبذة|نبذة عني|الهدف|الهدف الوظيفي|الملخص|الملخص المهني|البيانات الشخصية|معلومات الاتصال|اللغات|الجوائز)$/iu,
};
const bilingualHeadings = Object.fromEntries(Object.entries(headings).map(([section, pattern]) =>
  [section, new RegExp(`^(?:${pattern.source.slice(1, -1)})\\s+(?:${pattern.source.slice(1, -1)})$`, 'iu')]));
const fieldLabels = {
  name: /^(?:project(?: name| title)?|(?:graduation|capstone|final[- ]year) project|course(?: name)?|certification|certificate(?: name)?|degree|qualification|اسم المشروع|عنوان المشروع|مشروع التخرج|المشروع|اسم الدورة|الدورة|دورة|اسم الشهادة|الشهادة|شهادة|المؤهل|الدرجة العلمية)$/iu,
  organization: /^(?:organization|organisation|institution|university|school|company|client|الجهة|الجهة المنفذة|المؤسسة|الشركة|الجامعة|الجهة التعليمية)$/iu,
  issuer: /^(?:issuer|provider|platform|issued by|الجهة المانحة|المنصة|مقدم الدورة|الجهة المقدمة)$/iu,
  dates: /^(?:dates?|period|year|graduation|graduation date|expected graduation|التاريخ|الفترة|تاريخ التخرج|التخرج المتوقع|تاريخ التخرج المتوقع)$/iu,
  duration: /^(?:duration|length|مدة|المدة)$/iu,
  description: /^(?:description|details|الوصف|وصف المشروع|التفاصيل)$/iu,
  role: /^(?:role|my role|الدور|دوري)$/iu,
  technologies: /^(?:technologies|technology|tech stack|tools|التقنيات|التقنيات المستخدمة|الأدوات)$/iu,
  category: /^(?:category|project type|التصنيف|نوع المشروع)$/iu,
  college: /^(?:college|faculty|الكلية|كلية)$/iu,
  major: /^(?:major|specialization|field of study|التخصص|تخصص)$/iu,
  study_status: /^(?:status|study status|حالة الدراسة|الحالة الدراسية|حالة التخرج)$/iu,
  gpa: /^(?:gpa|cgpa|grade point average|المعدل(?: التراكمي)?|المعدل)$/iu,
};
const norm = value => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
const nonContentLine = /^(?:fictional test data\b|page\s+\d+(?:\s+of\s+\d+)?\b|cv\s+\d+\s+of\s+\d+\b|resume\s*[-|]\s*page\s+\d+\b)/iu;
const splitList = value => value.split(/[,،;؛•▪]/u).map(s => s.trim()).filter(Boolean);
const cleanBullet = value => value.replace(/^(?:[-*•▪]\s*|\d+[.)]\s*)/u, '').trim();
const resumeMonth = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)';
const resumeDatePoint = `(?:${resumeMonth}\\s+)?(?:19|20)\\d{2}`;
export function isLiteralSkillName(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 60
    && !/\b(?:university|college|faculty|bachelor|master|degree|diploma|project|course|certificat(?:e|ion)|student|engineer|analyst|developer|intern)\b|جامعة|كلية|بكالوريوس|ماجستير|تخصص|مشروع|دورة|شهادة|مهندس|مهندسة|مطور|محلل|متدرب|خريج/iu.test(name)
    && /^[\p{L}\p{N}][\p{L}\p{N}\s+#.()/-]*$/u.test(name)
    && !/[.]$|\b(?:19|20)\d{2}\b|https?:|ignore|instructions/iu.test(name);
}
export function localSectionHeading(value) {
  value = value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, '').replace(/^\s*(?:#{1,4}\s*|[•▪]\s*)/u, '').trim();
  const match = value.match(/^([^:：]+)(?:[:：]\s*(.*))?$/u);
  if (!match) return null;
  const label = norm(match[1]);
  // PDF bidi can move the separator to either edge. Recognize only two
  // complete aliases of the SAME section, never reorder the source fields.
  const headingLabel = label.replace(/^[/|]\s*|\s*[/|]$/gu, '');
  const bilingual = headingLabel.split(/\s*[/|]\s*/u);
  const mixedScripts = /[a-z]/iu.test(headingLabel) && /\p{Script=Arabic}/u.test(headingLabel);
  const section = Object.keys(headings).find(key => headings[key].test(label)
    || (bilingual.length > 1 && bilingual.every(part => headings[key].test(part)))
    || (mixedScripts && bilingualHeadings[key].test(headingLabel)));
  const singularTitle = /^(?:project|(?:graduation|capstone|final[- ]year) project|مشروع التخرج|course|certificate|certification)$/iu.test(label);
  return section ? { section, title: singularTitle && !!match[2], inline: singularTitle && match[2] ? value : match[2] ?? '' } : null;
}
function fields(value) {
  return value.split(/\s*[;؛|]\s*/u).map(part => {
    const match = cleanBullet(part).match(/^([^:：]+)[:：]\s*(.*)$/u);
    const field = match && Object.keys(fieldLabels).find(key => fieldLabels[key].test(norm(match[1])));
    if (field) return { field, value: match[2].trim(), label: norm(match[1]) };
    // PDF bidi extraction can place an explicit Arabic label after its Latin
    // value in the SAME cell. Recover only a recognized label, never reorder
    // dates, join columns or rewrite the original evidence.
    if (/[:：]$/u.test(part.trim())) {
      const body = part.trim().slice(0, -1).trim();
      for (const [key, label] of Object.entries(fieldLabels)) {
        const trailing = body.match(new RegExp(`\\s+(${label.source.slice(1, -1)})$`, 'iu'));
        if (trailing) return { field: key, value: body.slice(0, trailing.index).trim(), label: norm(trailing[1]) };
      }
    }
    return { raw: part.trim() };
  });
}
function emptyEntry(name, evidence) {
  return { name, organization: '', dates: '', description: '', evidence };
}
export function inferProject(entry) {
  if (entry.category) return { ...entry, category_basis: 'explicit', category_evidence: entry.category };
  const source = [...(entry.technologies ?? []), entry.description].join(' ');
  const rules = [
    ['ويب', /\b(?:HTML|CSS|JavaScript|React(?! Native)|Django|website|web application)\b|تطبيق ويب|موقع ويب/iu],
    ['جوال', /\b(?:Flutter|React Native|Swift|Kotlin|Android|iOS|mobile application)\b|تطبيق جوال/iu],
    ['بيانات', /\b(?:pandas|data analysis|data visualization|Power BI)\b|تحليل البيانات|تصور البيانات/iu],
    ['ذكاء اصطناعي', /\b(?:TensorFlow|PyTorch|machine learning|neural network)\b|تعلم الآلة|ذكاء اصطناعي/iu],
    ['أمن', /\b(?:penetration testing|encryption|cybersecurity)\b|اختبار الاختراق|تشفير|الأمن السيبراني/iu],
    ['قواعد بيانات', /\b(?:SQL|MySQL|PostgreSQL|SQLite|MongoDB)\b|قواعد البيانات/iu],
  ];
  const matches = rules.map(([category, regex]) => [category, source.match(regex)?.[0]]).filter(([, evidence]) => evidence);
  return { ...entry, category: matches.map(([name]) => name).join('، ') || 'غير محدد',
    category_basis: matches.length ? 'inferred' : 'unspecified', category_evidence: matches.map(([, evidence]) => evidence).join('، ') };
}

// This is deliberately section-and-label based, not semantic AI understanding.
// Ambiguous visual rows interrupt association instead of joining unrelated columns.
export function extractLocalSections(source, basic, matchSkill) {
  const output = { skills: basic.skills.filter(item => isLiteralSkillName(item.name)), experiences: basic.experiences,
    education: [], projects: [], courses: [], certificates: [], activities: [], unclassified: [] };
  const sectionStatus = {};
  const contentSeen = new Set();
  const warnings = [];
  let section = null, current = null, currentTarget = null, pendingEducationField = null, blocked = false;
  let skippedColumns = false;
  function reset() { current = null; currentTarget = null; pendingEducationField = null; }
  function appendEvidence(quote) {
    if (current && current.evidence !== quote && !current.evidence.endsWith('\n' + quote)) current.evidence += '\n' + quote;
  }
  function setField(field, value, quote) {
    current[field] = value;
    if (current.field_evidence) current.field_evidence[field] = quote;
    appendEvidence(quote);
  }
  function collectSkills(value, evidence) {
    for (const name of splitList(value)) {
      if (!isLiteralSkillName(name) || output.skills.length >= 80 || name.split(/\s+/u).length > 6) continue;
      output.skills.push({ name, mapped_skill_id: matchSkill(name), evidence });
    }
  }
  function start(name, evidence, target = section, allowEmpty = false) {
    if ((!name && !allowEmpty) || name.length > 180 || output[target].length >= 80) { reset(); sectionStatus[section] = 'uncertain'; return; }
    current = target === 'courses' || target === 'certificates'
      ? { name, issuer: '', date: '', ...(target === 'courses' ? { duration: '' } : {}), evidence, field_evidence: { name: evidence } }
      : { ...emptyEntry(name, evidence), field_evidence: name ? { name: evidence } : {} };
    currentTarget = target;
    if (['education', 'projects'].includes(target)) current.field_evidence = name ? { name: evidence } : {};
    output[target].push(current);
  }
  function educationField(field, value, quote) {
    if (field === 'study_status') {
      if (/\b(?:graduated|completed|degree awarded)\b|متخرج(?:ة)?|تخرج(?:ت)?/iu.test(value)) value = 'متخرج';
      else if (/expected|anticipated|على وشك التخرج|التخرج المتوقع/iu.test(value)) value = 'تخرج متوقع';
      else if (/currently|in progress|ongoing|قيد الدراسة|ما زلت أدرس|ما زال يدرس|ما زالت تدرس/iu.test(value)) value = 'قيد الدراسة';
    }
    if (['organization', 'college', 'major'].includes(field) && !plausibleEducationField(field, value.replace(/[.]$/u, ''))) {
      sectionStatus.education = 'uncertain'; return;
    }
    if (!current || currentTarget !== 'education' || (field === 'name' && current.name)
      || (['organization', 'college'].includes(field) && current[field] && current[field] !== value)) start('', quote, 'education', true);
    if (!current) return;
    setField(field, value, quote);
    if (field === 'name') {
      const major = literalMajor(value);
      if (major && !current.major) setField('major', major, quote);
    }
  }
  function projectDescription(value, quote) {
    if (!current || currentTarget !== 'projects') start('', quote, 'projects', true);
    if (!current) return;
    current.description = [current.description, value].filter(Boolean).join('\n');
    current.field_evidence.description = [current.field_evidence.description, quote].filter(Boolean).join('\n');
    appendEvidence(quote);
    if (!current.name) sectionStatus.projects = 'uncertain';
  }
  function process(value, lineId) {
    if (!value.trim() || !section || section === 'stop' || blocked) return;
    contentSeen.add(section);
    if (section === 'skills' || section === 'experiences') return; // Existing literal parser handles these.
    const text = cleanBullet(value);
    if (nonContentLine.test(text)) return;
    const tokens = fields(value);
    if (section === 'education' && /^(?:gpa|cgpa|المعدل(?: التراكمي)?)\s*[:：]/iu.test(text)) {
      const gpa = tokens.find(item => item.field === 'gpa' && item.value);
      if (gpa) educationField('gpa', gpa.value, value);
      return;
    }
    if (section === 'education' && /^(?:currently\s+(?:enrolled|studying|pursuing)|in\s+progress|ongoing|graduated(?:\s+(?:in\s+)?(?:19|20)\d{2})?|completed(?:\s+(?:in\s+)?(?:19|20)\d{2})?|قيد الدراسة|ما زلت أدرس|ما زال يدرس|ما زالت تدرس|متخرج(?:ة)?|تخرج(?:ت)?(?:\s+(?:في\s+)?[0-9٠-٩]{4})?|على وشك التخرج)$/iu.test(text)) {
      educationField('study_status', text, value);
      return;
    }
    if (section === 'education' && tokens.every(item => !item.field)) {
      const institutionText = tokens.map(item => item.raw ?? '').find(part => /\b(?:university|college|faculty|institute|school)\b|جامعة|كلية|معهد/iu.test(part) && !/\b(?:gpa|cgpa)\b/iu.test(part)) ?? text;
      const institutionParts = institutionText.split(/\s+[—–-]\s+/u);
      if (institutionParts.length === 2) {
        const facts = institutionParts.map(part => ({ field: academicFact(part), value: part }));
        if (facts.every(fact => ['organization', 'college'].includes(fact.field))) {
          for (const fact of facts) educationField(fact.field, fact.value, value);
          return;
        }
      }
    }
    if (section === 'education' && pendingEducationField && tokens.every(item => !item.field)) {
      const field = pendingEducationField; pendingEducationField = null;
      if (plausibleEducationField(field, text)) educationField(field, text, value);
      else { sectionStatus.education = 'uncertain'; reset(); }
      return;
    }
    pendingEducationField = null;
    if (section === 'education' && tokens.length === 1 && tokens[0].field && !tokens[0].value
      && ['name', 'organization', 'college', 'major'].includes(tokens[0].field)) {
      pendingEducationField = tokens[0].field; return;
    }
    if (section === 'projects' && currentTarget === 'projects' && current?.name && isDate(text)) {
      setField('dates', text, value);
      current.date_line_id = lineId;
      return;
    }
    if (['courses', 'certificates'].includes(section) && currentTarget === section && current?.name && isDate(text)) {
      setField('date', text, value);
      current.date_line_id = lineId;
      return;
    }
    if (section === 'courses' && currentTarget === 'courses' && current?.name
      && /^\d+\s*(?:weeks?|months?|hours?|days?|أسبوع(?:ين|ان)?|أسابيع|شهر|أشهر|ساعة|ساعات|يوم|أيام)$/iu.test(text)) {
      setField('duration', text, value);
      return;
    }
    const title = tokens.find(item => item.field === 'name');
    const credentialLine = !title && ['courses', 'certificates'].includes(section) ? parseCredentialLine(text) : null;
    if (credentialLine) {
      const { name, issuer, date, duration } = credentialLine;
      if (name.length <= 150 && issuer.length <= 120) {
        const workplaceTraining = section === 'courses' && date
          && /\b(?:intern(?:ship)?|trainee|apprentice|work placement|practicum|co[- ]?op placement|industrial training)\b|تدريب(?: ميداني| تعاوني| عملي)|متدرب(?:ة)?/iu.test(name);
        if (workplaceTraining) {
          const duplicate = output.experiences.some(item => norm([item.role, item.organization, item.dates].join('|'))
            === norm([name, issuer, date].join('|')));
          if (!duplicate && output.experiences.length < 80) {
            output.experiences.push({ role: name, organization: issuer, dates: date, description: '', date_line_id: lineId,
              evidence: value, field_evidence: { role: value, organization: value, dates: value } });
          }
          contentSeen.add('experiences');
          reset();
          return;
        }
        start(name, value, section);
        if (current) {
          if (issuer) setField('issuer', issuer.trim(), value);
          if (date) { setField('date', date, value); current.date_line_id = lineId; }
          if (duration && currentTarget === 'courses') setField('duration', duration, value);
        }
        return;
      }
    }
    const projectTitleLine = section === 'projects'
      ? text.match(/^(.+?)\s*\|\s*((?:19|20)\d{2}(?:\s*[-–]\s*(?:19|20)\d{2})?)$/u) : null;
    if (!title && projectTitleLine && projectTitleLine[1].length <= 150) {
      start(projectTitleLine[1].trim(), value, 'projects');
      if (current) {
        setField('dates', projectTitleLine[2], value);
        current.date_line_id = lineId;
      }
      return;
    }
    if (section === 'projects' && currentTarget === 'projects' && current?.name
      && tokens.every(item => !item.field)) {
      const technologies = splitList(text);
      if (technologies.length > 1 && technologies.every(name => isLiteralSkillName(name) && matchSkill(name))) {
        setField('technologies', technologies, value);
        collectSkills(text, value);
        return;
      }
    }
    const projectTechnologyLine = section === 'projects' && !title
      ? text.match(/^(.+?)\s*\|\s*([^|]+)$/u) : null;
    if (projectTechnologyLine) {
      const [, projectName, technologyText] = projectTechnologyLine;
      const technologies = splitList(technologyText);
      if (projectName.length <= 150 && technologies.length
        && technologies.every(name => isLiteralSkillName(name)
          && (technologies.length > 1 || matchSkill(name) || /^[A-Z][A-Za-z0-9.+#/-]*$/u.test(name)))) {
        start(projectName.trim(), value, 'projects');
        if (current) {
          setField('technologies', technologies, value);
          collectSkills(technologyText, value);
        }
        return;
      }
    }
    const explicitCourse = title && /course|دورة|الدورة/iu.test(title.label);
    const explicitCert = title && /certificat|شهادة|الشهادة/iu.test(title.label);
    if (title) {
      let target = section;
      if (explicitCourse) target = 'courses';
      else if (explicitCert) target = 'certificates';
      else if (/project|المشروع|مشروع التخرج/iu.test(title.label)) target = 'projects';
      else if (/degree|qualification|المؤهل|الدرجة/iu.test(title.label)) target = 'education';
      if (section === 'certificates' && /course completion|إتمام دورة|اتمام دورة|اجتياز دورة/iu.test(title.value)) target = 'courses';
      if (/^(?:شهادة مهنية|professional certificate|certificate)$/iu.test(title.value)) target = 'unclassified';
      if ((['education', 'projects'].includes(target) && target !== section)
        || (['education', 'projects'].includes(section) && target !== section)) {
        sectionStatus[section] = 'uncertain'; sectionStatus[target] = 'uncertain';
        blocked = true; reset(); return;
      }
      if (target === 'projects' && isDescription(title.value)) { projectDescription(title.value, value); return; }
      if (target === 'education' && isDescription(title.value.replace(/[.]$/u, ''))) {
        sectionStatus.education = 'uncertain'; reset(); return;
      }
      if (target === 'education') educationField('name', title.value, value);
      else start(title.value, value, target);
    } else if (tokens.every(item => !item.field)) {
      if (section === 'education') {
        const combined = combinedEducationFacts(text);
        if (combined) {
          start('', value, 'education', true);
          for (const fact of combined) {
            if (fact.field === 'dates') {
              if (currentTarget === 'education') {
                setField('dates', fact.value, value);
                current.date_line_id = lineId;
              }
            } else educationField(fact.field, fact.value, value);
          }
          return;
        }
        const fact = academicFact(text);
        if (fact) educationField(fact, text, value);
        else { sectionStatus.education = 'uncertain'; reset(); }
        return;
      }
      if (section === 'projects' && isDescription(text)) { projectDescription(text, value); return; }
      const numbered = /^(?:[-*•▪]\s+|\d+[.)]\s+)/u.test(value);
      const jobLike = /\b(?:at|engineer|developer|analyst)\b|لدى|مهندس|مطور|محلل/iu.test(text);
      if (['projects', 'courses', 'certificates', 'unclassified', 'activities'].includes(section)
        && text.length <= 150 && !/[.!?؟]$/u.test(text) && !jobLike
        && (numbered || (text.split(/\s+/u).length >= 2 && !isDate(text))
          || (section === 'projects' && text.length >= 3 && !/[.!?؟]$/u.test(text) && !isDate(text))
          || (section === 'certificates' && /\+|certified|شهادة/iu.test(text)))) {
        const target = section === 'certificates' && /^شهادة مهنية[،,\s]/u.test(text) ? 'unclassified'
          : section === 'certificates' && /course completion|completion of .+ course|إتمام دورة|إتمام الدورة|اجتياز دورة/iu.test(text) ? 'courses' : section;
        start(text, value, target);
      } else {
        if (text) sectionStatus[section] = 'uncertain'; reset();
        return;
      }
    } else if (section === 'education' && (!current || currentTarget !== 'education')) {
      const first = tokens.find(item => ['organization', 'college', 'major'].includes(item.field) && item.value);
      if (first) educationField(first.field, first.value, value);
      else { sectionStatus.education = 'uncertain'; return; }
    } else if (section === 'projects' && !current && tokens.some(item => item.field === 'description' && item.value)) {
      start('', value, 'projects', true);
    } else if (!current) {
      sectionStatus[section] = 'uncertain';
      return;
    } else current.evidence += '\n' + value;
    if (!current) return;
    if (currentTarget === 'education' && !current.major) {
      const major = literalMajor(current.name);
      if (major) setField('major', major, value);
    }
    for (const token of tokens) {
      if (!token.field || token.field === 'name' || !token.value) continue;
      let field = token.field;
      if (currentTarget === 'courses' || currentTarget === 'certificates') {
        if (field === 'organization') field = 'issuer';
        if (field === 'dates') field = 'date';
        if (!['issuer', 'date'].includes(field) && !(currentTarget === 'courses' && field === 'duration')) continue;
      }
      if (field === 'technologies') {
        if (currentTarget !== 'projects') continue;
        current.technologies = splitList(token.value);
        current.field_evidence.technologies = value;
        collectSkills(token.value, value);
      } else {
        const allowed = currentTarget === 'education' ? ['organization', 'dates', 'description', 'college', 'major', 'study_status', 'gpa']
          : currentTarget === 'projects' ? ['organization', 'dates', 'description', 'role', 'category']
          : currentTarget === 'courses' ? ['issuer', 'date', 'duration']
            : currentTarget === 'certificates' ? ['issuer', 'date'] : ['organization', 'dates', 'duration', 'description'];
        if (allowed.includes(field)) {
          if (currentTarget === 'education' && ['organization', 'college', 'major'].includes(field)
            && !plausibleEducationField(field, token.value.replace(/[.]$/u, ''))) {
            sectionStatus.education = 'uncertain'; continue;
          }
          if (currentTarget === 'projects' && field === 'description') projectDescription(token.value, value);
          else setField(field, token.value, value);
        }
      }
      if (['dates', 'date'].includes(field)) current.date_line_id = lineId;
      if (currentTarget === 'education' && field === 'dates' && !current.study_status
        && /expected graduation|(?:تاريخ )?التخرج المتوقع/iu.test(token.label)) {
        const marker = value.match(/expected\s+graduation|(?:تاريخ\s+)?التخرج\s+المتوقع/iu)?.[0];
        if (marker) setField('study_status', value.trim(), value);
      }
    }
  }
  for (const raw of source.split('\n')) {
    const lineId = raw.match(/^\[([PD]\d+L\d+)/u)?.[1] ?? '';
    const row = raw.replace(/^\[[PD]\d+L\d+(?: y=\d+)?\]\s*/u, '');
    const cells = row.split(/\s+\|\s+(?=\(x=)/u).map(cell => cell.replace(/^\(x=\d+\)\s*/u, '').trim()).filter(Boolean);
    const foundHeadings = cells.map(cell => localSectionHeading(cell)).filter(Boolean);
    const found = foundHeadings[0];
    if (found) {
      if (cells.length > 1) {
        for (const item of foundHeadings) sectionStatus[item.section] = 'uncertain';
        section = null; blocked = true; skippedColumns = true; reset(); continue;
      }
      if (found.title) {
        const qualification = ['courses', 'certificates', 'unclassified'];
        if (section === found.section || (qualification.includes(section) && qualification.includes(found.section))) {
          process(cells[0], lineId); continue;
        }
        // A field such as "Project: ..." inside Education/Courses is not
        // permission to switch sections or borrow the following university.
        if (section) sectionStatus[section] = 'uncertain';
        sectionStatus[found.section] = 'uncertain';
        blocked = true; reset(); continue;
      }
      section = found.section; blocked = false; reset();
      sectionStatus[section] ??= 'not_found';
      if (found.inline && cells.length === 1) process(found.inline, lineId);
      else if (cells.length > 1) { sectionStatus[section] = 'uncertain'; skippedColumns = true; }
      continue;
    }
    if (cells.length !== 1) {
      if (section && ['education', 'projects'].includes(section)) {
        for (const cell of cells) process(cell, lineId);
        continue;
      }
      if (section) sectionStatus[section] = 'uncertain';
      skippedColumns = true; blocked = true; reset(); continue;
    }
    process(cells[0], lineId);
  }
  output.projects = output.projects.map(inferProject);
  for (const entry of output.education) {
    if (!entry.study_status) {
      const status = inferStudyStatus(entry.field_evidence?.dates ?? entry.evidence, entry.dates);
      if (!status) continue;
      entry.study_status = status;
      entry.field_evidence.study_status = entry.field_evidence.dates ?? entry.evidence;
    }
  }
  for (const target of ['education', 'projects']) for (const entry of output[target]) {
    entry.needs_review = ['name', ...(target === 'education' ? ['organization', 'major'] : [])].filter(field => !entry[field]);
    if (entry.needs_review.length) sectionStatus[target] = 'uncertain';
  }
  const nonSkillNames = new Set(['projects', 'education', 'courses', 'certificates', 'experiences'].flatMap(key => output[key]
    .flatMap(item => [item.name, item.role, item.organization, item.issuer, item.college, item.major].filter(Boolean).map(normalizeSkillName))));
  output.skills = output.skills.filter(item => !nonSkillNames.has(normalizeSkillName(item.name)) || matchSkill(item.name));
  for (const key of Object.keys(output)) {
    const unique = new Map();
    for (const item of output[key]) {
      const identity = key === 'skills' ? normalizeSkillName(item.name)
        : norm([item.name ?? item.role, item.organization ?? item.issuer ?? '', ['courses', 'certificates'].includes(key) ? '' : item.dates ?? ''].join('|'));
      if (!unique.has(identity)) unique.set(identity, item);
      else if (key !== 'skills' && unique.get(identity).evidence !== item.evidence) {
        unique.get(identity).evidence += '\n' + item.evidence;
      }
    }
    output[key] = [...unique.values()].slice(0, 80);
  }
  const courseKeys = new Set(output.courses.map(item => norm([item.name, item.issuer].join('|'))));
  output.certificates = output.certificates.filter(item => {
    if (!courseKeys.has(norm([item.name, item.issuer].join('|')))) return true;
    output.unclassified.push({ ...emptyEntry(item.name, item.evidence), organization: item.issuer, dates: item.date, description: 'ورد الاسم نفسه كدورة وشهادة؛ راجع التصنيف قبل اعتماده.' });
    warnings.push('ورد بند مكرر بين الدورات والشهادات؛ لم نحتسبه مرتين.');
    return false;
  });
  if (skippedColumns) warnings.push('توجد صفوف PDF متعددة الأعمدة لم نستطع ربطها بثقة؛ تُركت للمراجعة ولم تُخلط بيانات الأعمدة.');
  if (output.projects.some(item => !item.name)) warnings.push('ورد وصف مشروع دون اسم مؤكد؛ أبقينا الوصف ودليله وتركنا اسم المشروع فارغًا يحتاج مراجعة، ولم نحوله إلى عنوان.');
  if (output.education.some(item => item.needs_review.length)) warnings.push('بعض حقول التعليم غير مؤكدة؛ استُخرجت المعلومات الصريحة من قسم التعليم فقط وتُركت الحقول الناقصة فارغة للمراجعة.');
  if (output.unclassified.length) warnings.push('توجد بنود لم يُحسم نوعها بين دورة وشهادة أو تحتاج تصنيفًا يدويًا؛ لا تُحتسب حتى مراجعتها.');
  output.unclassified = output.unclassified.slice(0, 80);
  for (const key of ['skills', 'projects', 'courses', 'certificates', 'education', 'experiences']) {
    sectionStatus[key] = sectionStatus[key] === 'uncertain' ? 'uncertain' : output[key].length ? 'extracted' : contentSeen.has(key) ? 'uncertain' : 'not_found';
  }
  return { ...output, parser_version: CV_PARSER_VERSION, analyzed_at: new Date().toISOString(), section_status: sectionStatus,
    warnings: ['تحليل محلي محدود بقواعد وأقسام وليس فهم ذكاء اصطناعي كاملًا. استخرجنا فقط معلومات صريحة بأدلتها؛ لم نخمن الجهات أو التواريخ أو المعلومات الناقصة. الأقسام غير المستخرجة لا تثبت عدم امتلاكها. تصنيف المشروع المستنتج من التقنيات مميّز عن النص الأصلي.', ...warnings] };
}
function parseCredentialLine(text) {
  let remainder = text.trim(), date = '', duration = '';
  const durationMatch = remainder.match(/\b\d+\s*(?:weeks?|months?|hours?|days?|أسبوع(?:ين|ان)?|أسابيع|شهر|أشهر|ساعة|ساعات|يوم|أيام)(?:\s*(?:\/|,|and|و)\s*\d+\s*(?:weeks?|months?|hours?|days?|أسبوع(?:ين|ان)?|أسابيع|شهر|أشهر|ساعة|ساعات|يوم|أيام))?/iu);
  if (durationMatch) {
    duration = durationMatch[0];
    remainder = remainder.replace(durationMatch[0], '').replace(/[|,،;؛—–-]\s*$/u, '').trim();
  }
  const datePattern = new RegExp('(?:\\s*\\(\\s*|\\s*[,|]\\s*)(' + resumeDatePoint
    + '(?:\\s*[-–—]\\s*' + resumeDatePoint + ')?)\\s*\\)?$', 'iu');
  const dateMatch = remainder.match(datePattern);
  if (dateMatch) {
    date = dateMatch[1].trim();
    remainder = remainder.slice(0, dateMatch.index).replace(/\s*[,|;(—–-]\s*$/u, '').trim();
  }
  const split = remainder.match(/^(.+?)\s+(?:[—–-]|\|)\s+(.+)$/u)
    ?? remainder.match(/^(.+?)\s+by\s+(.+)$/iu)
    ?? remainder.match(/^([^,،;؛]{2,150})\s*[,،;؛]\s*(.{2,120})$/u);
  if (!split) return null;
  const name = split[1].trim(), issuer = split[2].trim();
  if (!name || !issuer || name.length > 150 || issuer.length > 120 || isDate(name)) return null;
  return { name, issuer, date, duration };
}

function isDate(value) {
  return /^(?:[0-9٠-٩]{4})(?:\s*[-–]\s*[0-9٠-٩]{4})?$/u.test(value)
    || new RegExp('^' + resumeDatePoint + '$', 'iu').test(value.trim())
    || new RegExp(`^${resumeDatePoint}\\s*(?:[-–—]|\\bto\\b|\\buntil\\b)\\s*(?:${resumeDatePoint}|present|current|now)$`, 'iu').test(value.trim());
}
