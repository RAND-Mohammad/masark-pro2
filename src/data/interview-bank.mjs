// Curated practice material, not real employer questions or a hiring assessment.
const families = {
  C01: [
    ['api', 'كيف تصمم API موثوقة وتختبرها؟', 'How would you design and test a reliable API?', [['تحقق', 'validation'], ['اختبار', 'test'], ['خطأ', 'error']]],
    ['version', 'كيف تتعامل مع تعارض تعديلات Git داخل فريق؟', 'How would you resolve a Git merge conflict in a team?', [['فرع', 'branch'], ['تعارض', 'conflict'], ['اختبار', 'test']]],
  ],
  C02: [
    ['quality', 'كيف تتحقق من جودة البيانات قبل بناء لوحة مؤشرات؟', 'How do you check data quality before building a dashboard?', [['مفقود', 'missing', 'null'], ['تكرار', 'duplicate'], ['تحقق', 'validate', 'validation']]],
    ['metric', 'كيف تختار مؤشرًا يجيب عن سؤال أعمال؟', 'How do you choose a metric that answers a business question?', [['هدف', 'goal', 'objective'], ['مصدر', 'source'], ['تعريف', 'definition', 'define']]],
  ],
  C03: [
    ['leakage', 'كيف تمنع تسرب البيانات عند تقييم نموذج؟', 'How do you prevent data leakage when evaluating a model?', [['تدريب', 'train', 'training'], ['اختبار', 'test'], ['تقسيم', 'split']]],
    ['imbalance', 'كيف تقيّم مصنفًا لبيانات غير متوازنة؟', 'How would you evaluate a classifier on imbalanced data?', [['دقة إيجابية', 'precision'], ['استرجاع', 'recall'], ['مصفوفة', 'confusion', 'f1']]],
  ],
  C04: [
    ['evaluation', 'كيف تقارن نموذج ذكاء اصطناعي بخط أساس؟', 'How do you compare an AI model with a baseline?', [['خط أساس', 'baseline'], ['اختبار', 'test'], ['مقياس', 'metric']]],
    ['safety', 'كيف تقلل مخاطر مخرجات نموذج لغوي غير صحيحة؟', 'How would you reduce the risk of incorrect language-model outputs?', [['تحقق', 'verify', 'validation'], ['مصدر', 'source', 'evidence'], ['مراجعة', 'review', 'human']]],
  ],
  C05: [
    ['incident', 'ماذا تفعل عند الاشتباه باختراق حساب؟', 'What would you do after a suspected account compromise?', [['عزل', 'isolate', 'contain'], ['سجل', 'logs', 'log'], ['استعادة', 'recovery', 'recover']]],
    ['access', 'كيف تطبق مبدأ أقل صلاحية؟', 'How do you apply least privilege?', [['دور', 'role'], ['حاجة', 'need'], ['مراجعة', 'review', 'audit']]],
  ],
  C06: [
    ['network', 'كيف تشخص انقطاع اتصال مستخدم بالشبكة؟', 'How would you diagnose a user network outage?', [['عنوان', 'ip'], ['اتصال', 'ping', 'connectivity'], ['dns', 'اسم نطاق']]],
    ['segments', 'لماذا نقسم الشبكة وكيف نتحقق من العزل؟', 'Why segment a network, and how do you verify isolation?', [['عزل', 'isolation', 'isolate'], ['وصول', 'access'], ['اختبار', 'test']]],
  ],
  C07: [
    ['database', 'كيف تحقق سلامة البيانات عند تحديث جداول مترابطة؟', 'How do you maintain integrity when updating related tables?', [['معاملة', 'transaction'], ['مفتاح', 'key', 'constraint'], ['تراجع', 'rollback']]],
    ['backup', 'كيف تتأكد أن النسخة الاحتياطية قابلة للاستعادة؟', 'How do you verify a backup can actually be restored?', [['استعادة', 'restore'], ['اختبار', 'test'], ['تحقق', 'verify', 'validation']]],
  ],
  C08: [
    ['operations', 'كيف تتعامل مع خدمة متوقفة دون فقد البيانات؟', 'How would you handle a service outage without losing data?', [['سجل', 'logs', 'log'], ['نسخة', 'backup'], ['استعادة', 'restore', 'rollback']]],
    ['monitoring', 'ما الذي تراقبه لاكتشاف مشكلة قبل تأثيرها على المستخدم؟', 'What would you monitor to detect a problem before users are affected?', [['زمن', 'latency', 'time'], ['خطأ', 'error'], ['تنبيه', 'alert']]],
  ],
  C09: [
    ['requirements', 'كيف تحوّل حاجة صاحب مصلحة إلى متطلب قابل للاختبار؟', 'How do you turn a stakeholder need into a testable requirement?', [['مصلحة', 'stakeholder'], ['قبول', 'acceptance'], ['تحقق', 'validate', 'validation']]],
    ['change', 'كيف تدير تغيير المتطلبات أثناء التنفيذ؟', 'How would you manage a requirement change during delivery?', [['أثر', 'impact'], ['أولوية', 'priority'], ['توثيق', 'document']]],
  ],
};
const common = [
  ['star', 'اشرح موقفًا واجهت فيه تحديًا مستخدمًا مثالًا حقيقيًا أو فرضية مصرحًا بها.', 'Describe a challenge using a real example or an explicitly hypothetical scenario.', [['موقف', 'situation', 'context'], ['إجراء', 'action', 'عملت'], ['نتيجة', 'result', 'outcome']]],
  ['learn', 'كيف تتعلم مهارة جديدة وتتحقق من أنك أتقنت أساسياتها؟', 'How do you learn a new skill and check your understanding?', [['هدف', 'goal'], ['تطبيق', 'practice', 'project'], ['مراجعة', 'feedback', 'review']]],
];
export const interviewCareerIds = Object.keys(families);
export function interviewQuestions(careerId, language = 'ar') {
  if (!Object.hasOwn(families, careerId)) return [];
  return [...families[careerId], ...common].map(([id, ar, en, concepts]) => ({
    id: `${careerId}-${id}`, careerId, prompt: language === 'en' ? en : ar,
    concepts: concepts.map(terms => language === 'en' ? terms.find(term => /^[a-z]/i.test(term)) ?? terms[0] : terms[0]),
  }));
}
export function interviewRubric(careerId, questionId) {
  if (!Object.hasOwn(families, careerId)) return null;
  return [...families[careerId], ...common].find(([id]) => `${careerId}-${id}` === questionId)?.[3] ?? null;
}
