export type CareerProfile = {
  education: string;
  experience: string;
  certifications: string;
  projects: string[];
  evidenceKeywords: string[];
  majorKeywords: string[];
  sources: { label: string; url: string }[];
};

const sharedMajors = ['computer science', 'computing', 'information technology', 'software engineering', 'علوم الحاسب', 'الحاسب', 'تقنية المعلومات', 'هندسة البرمجيات'];

export const careerProfiles: Record<string, CareerProfile> = {
  C01: {
    education: 'الدرجة الجامعية في علوم الحاسب أو هندسة البرمجيات شائعة، وتوجد وظائف تقبل ملف أعمال قويًا ومسارًا تدريبيًا بديلًا.',
    experience: 'للمبتدئ: تطبيق كامل موثّق، اختبارات، Git ومساهمة جماعية أو تدريب تعاوني أدلة أقوى من مشروع واجهة بلا منطق أو توثيق.',
    certifications: 'لا توجد شهادة إلزامية عامة لمهندس البرمجيات؛ شهادة GitHub مساندة لإثبات أساسيات التعاون وإدارة المصدر.',
    projects: ['تطبيق كامل بواجهة وAPI وقاعدة بيانات واختبارات', 'مساهمة موثقة في مشروع جماعي باستخدام Git وطلبات الدمج'],
    evidenceKeywords: ['software', 'developer', 'application', 'api', 'backend', 'frontend', 'full stack', 'برمج', 'تطبيق', 'واجهات', 'اختبار'],
    majorKeywords: [...sharedMajors],
    sources: [
      { label: 'O*NET — Software Developers', url: 'https://www.onetonline.org/link/summary/15-1252.00' },
      { label: 'SFIA 9 — Software engineering roles', url: 'https://sfia-online.org/en/tools-and-resources/standard-industry-skills-profiles/sfia-9-skills-for-role-families-job-titles' },
    ],
  },
  C02: {
    education: 'الخلفيات الشائعة تشمل الحاسب ونظم المعلومات والإحصاء والأعمال. يهم أن يثبت المتقدم فهم البيانات والسياق التجاري.',
    experience: 'للمبتدئ: مشروع ينظف بيانات حقيقية، يكتب استعلامات SQL، يبني لوحة معلومات ويشرح قرارًا قابلًا للتنفيذ.',
    certifications: 'PL-300 مناسبة لمن يستهدف وظائف تستخدم Power BI، لكنها اختيارية ولا تعوض المشروع العملي.',
    projects: ['لوحة Power BI أو Tableau بمؤشرات واضحة', 'تحليل بيانات باستخدام SQL مع تقرير يشرح النتائج'],
    evidenceKeywords: ['data analyst', 'analytics', 'power bi', 'tableau', 'dashboard', 'sql', 'تحليل بيانات', 'لوحة معلومات', 'تقارير'],
    majorKeywords: [...sharedMajors, 'statistics', 'business analytics', 'information systems', 'إحصاء', 'نظم المعلومات', 'تحليل الأعمال'],
    sources: [{ label: 'Microsoft Learn — Data Analyst', url: 'https://learn.microsoft.com/en-us/training/career-paths/data-analyst' }],
  },
  C03: {
    education: 'علوم البيانات أو الحاسب أو الإحصاء والرياضيات خلفيات شائعة. بعض الأدوار البحثية قد تطلب دراسات عليا، بينما تكفي البكالوريوس ومشاريع قوية لأدوار مبتدئة أخرى.',
    experience: 'ينبغي أن يوضح المشروع صياغة المشكلة، تحليل البيانات، اختيار النموذج، التحقق بالمقاييس وشرح حدود النتيجة.',
    certifications: 'شهادة تعلم آلة تطبيقية قد تدعم الملف، لكنها لا تعوض الإحصاء والتجربة الصحيحة وشرح النتائج.',
    projects: ['دراسة تنبؤية تقارن نماذج وتوثق المقاييس والتحيز', 'تحليل استكشافي مع فرضيات واختبارات وشرح للأثر'],
    evidenceKeywords: ['data science', 'data scientist', 'statistical', 'prediction', 'model', 'experiment', 'علم البيانات', 'إحصاء', 'تنبؤ', 'نموذج'],
    majorKeywords: [...sharedMajors, 'data science', 'statistics', 'mathematics', 'علوم البيانات', 'إحصاء', 'رياضيات'],
    sources: [
      { label: 'SDAIA — Professions in Data and AI', url: 'https://sdaia.gov.sa/en/MediaCenter/KnowledgeCenter/ResearchLibrary/Professions-in-the-Fields-of-Data-Ai.pdf' },
      { label: 'O*NET — Data Scientists', url: 'https://www.onetonline.org/link/summary/15-2051.00' },
    ],
  },
  C04: {
    education: 'أساس قوي في الحاسب والرياضيات وتعلم الآلة مهم. الدور هندسي ويجمع بناء النماذج مع البرمجة والنشر والمراقبة.',
    experience: 'المشروع الأقوى يمر بدورة كاملة: تجهيز البيانات، تدريب وتقييم، API أو خدمة للنموذج، نشر ومراقبة للإصدارات والأداء.',
    certifications: 'شهادات ML السحابية متوسطة أو متقدمة ومكلفة غالبًا؛ تُعرض كخيار بعد بناء أساس عملي وليست شرط بداية.',
    projects: ['خدمة ML منشورة عبر API مع تتبع التجارب', 'تطبيق ذكاء اصطناعي يقيس الجودة ويراقب أداء النموذج بعد النشر'],
    evidenceKeywords: ['machine learning engineer', 'mlops', 'model deployment', 'tensorflow', 'pytorch', 'artificial intelligence', 'تعلم الآلة', 'ذكاء اصطناعي', 'نشر نموذج'],
    majorKeywords: [...sharedMajors, 'artificial intelligence', 'data science', 'ذكاء اصطناعي', 'علوم البيانات'],
    sources: [
      { label: 'SDAIA — Professions in Data and AI', url: 'https://sdaia.gov.sa/en/MediaCenter/KnowledgeCenter/ResearchLibrary/Professions-in-the-Fields-of-Data-Ai.pdf' },
      { label: 'SFIA 9 — Machine learning engineering practitioners', url: 'https://sfia-online.org/en/tools-and-resources/standard-industry-skills-profiles/sfia-9-skills-for-role-families-job-titles' },
    ],
  },
  C05: {
    education: 'الأمن السيبراني أو علوم الحاسب أو تقنية المعلومات خلفيات شائعة، ويمكن دعمها بمختبرات دفاع وتحليل موثقة.',
    experience: 'مشاريع SOC منزلية قانونية، تحليل سجلات، توثيق حادث، تقييم مخاطر ومختبرات دفاع مصرح بها أدلة مناسبة للمبتدئ.',
    certifications: 'SC-200 مرتبطة بتحليل عمليات الأمن على تقنيات Microsoft. الشهادات الأمنية اختيارية وتختلف باختلاف بيئة الجهة.',
    projects: ['مختبر SOC يحلل سجلات وينشئ تنبيهات ويكتب تقرير حادث', 'تقييم مخاطر وثغرات لنظام تملكه مع خطة معالجة'],
    evidenceKeywords: ['cybersecurity', 'security analyst', 'soc', 'siem', 'incident response', 'vulnerability', 'أمن سيبراني', 'حوادث', 'ثغرات', 'مخاطر'],
    majorKeywords: [...sharedMajors, 'cybersecurity', 'information security', 'أمن سيبراني', 'أمن المعلومات'],
    sources: [
      { label: 'O*NET — Information Security Analysts', url: 'https://www.onetonline.org/link/summary/15-1212.00' },
      { label: 'Microsoft Learn — Security Operations Analyst', url: 'https://learn.microsoft.com/en-us/training/career-paths/security-operations-analyst' },
    ],
  },
  C06: {
    education: 'الشبكات أو تقنية المعلومات أو علوم الحاسب خلفيات شائعة، وتبرز في هذا المسار المهارة العملية في الإعداد والاستكشاف والإصلاح.',
    experience: 'مختبر يطبق العنونة وVLAN والتوجيه والمراقبة والأمن مع مخطط شبكة وتقرير أعطال دليل مناسب للمبتدئ.',
    certifications: 'CCNA شهادة مرتبطة مباشرة بأساسيات الشبكات، لكنها اختبار مدفوع ولا تعد شرطًا عامًا لكل جهة.',
    projects: ['تصميم شبكة مؤسسة صغيرة مع VLAN والتوجيه والأمن', 'مختبر مراقبة شبكة وتشخيص أعطال موثّق'],
    evidenceKeywords: ['network', 'routing', 'switching', 'vlan', 'cisco', 'network support', 'شبكات', 'توجيه', 'محولات', 'أعطال'],
    majorKeywords: [...sharedMajors, 'network engineering', 'networks', 'هندسة الشبكات', 'شبكات'],
    sources: [{ label: 'O*NET — Computer Network Architects', url: 'https://www.onetonline.org/link/summary/15-1241.00' }],
  },
  C07: {
    education: 'علوم الحاسب أو نظم المعلومات أو علوم البيانات مناسبة. يركز الدور على موثوقية خطوط البيانات ومخازنها أكثر من بناء النموذج الإحصائي.',
    experience: 'للمبتدئ: خط ETL أو ELT يجمع بيانات من أكثر من مصدر، يتحقق من الجودة، يخزنها ويشغّلها تلقائيًا مع مراقبة للأخطاء.',
    certifications: 'Fabric Data Engineer Associate شهادة متوسطة ومخصصة لمهندس البيانات؛ الاختبار مدفوع والتدريب الذاتي على Microsoft Learn مجاني.',
    projects: ['خط بيانات batch أو streaming مع اختبارات جودة ومراقبة', 'مستودع بيانات أو lakehouse بنموذج واضح واستعلامات أداء'],
    evidenceKeywords: ['data engineer', 'etl', 'elt', 'pipeline', 'data warehouse', 'lakehouse', 'spark', 'هندسة البيانات', 'خط بيانات', 'مستودع بيانات'],
    majorKeywords: [...sharedMajors, 'data engineering', 'data science', 'information systems', 'هندسة البيانات', 'علوم البيانات', 'نظم المعلومات'],
    sources: [
      { label: 'SFIA 9 — Data engineering', url: 'https://sfia-online.org/en/sfia-9/skills/data-engineering' },
      { label: 'Microsoft Learn — Data Engineer', url: 'https://learn.microsoft.com/en-us/training/career-paths/data-engineer' },
    ],
  },
  C08: {
    education: 'تقنية المعلومات أو علوم الحاسب أو هندسة البرمجيات خلفيات شائعة. المهارات العملية في Linux والسحابة والأتمتة أهم من اسم التخصص وحده.',
    experience: 'المشروع المناسب ينشئ بنية سحابية قابلة للتكرار، يبني CI/CD، يدير الأسرار ويراقب الخدمة مع إجراء استعادة أو استجابة لعطل.',
    certifications: 'الشهادات السحابية مفيدة إذا كانت المنصة مطلوبة في الوظيفة. نعرض شهادة تأسيسية ونبقي الإنجاز العملي جزءًا أكبر من الحسبة.',
    projects: ['نشر تطبيق بحاويات وCI/CD ومراقبة وسجلات', 'بنية سحابية ككود مع إدارة أسرار وخطة استعادة'],
    evidenceKeywords: ['devops', 'cloud', 'ci/cd', 'pipeline', 'docker', 'kubernetes', 'terraform', 'deployment', 'سحابة', 'نشر', 'حاويات', 'أتمتة'],
    majorKeywords: [...sharedMajors, 'cloud computing', 'systems', 'حوسبة سحابية', 'نظم'],
    sources: [
      { label: 'SFIA 9 — Cloud DevOps role family', url: 'https://sfia-online.org/en/tools-and-resources/standard-industry-skills-profiles/sfia-9-skills-for-role-families-job-titles' },
      { label: 'Microsoft Learn — DevOps Engineer', url: 'https://learn.microsoft.com/en-us/training/career-paths/devops-engineer' },
    ],
  },
  C09: {
    education: 'نظم المعلومات أو علوم الحاسب أو تحليل الأعمال خلفيات مناسبة؛ يتطلب الدور فهم التقنية والعمليات والتواصل مع أصحاب المصلحة.',
    experience: 'دراسة حالة تشمل مقابلات أو افتراضات واضحة، تحليل عملية، متطلبات وظيفية وغير وظيفية، نماذج ورسوم وقبول للحل.',
    certifications: 'ECBA شهادة تأسيسية في تحليل الأعمال بلا متطلبات خبرة محددة، لكنها مدفوعة ولا تُعامل كشرط لكل وظيفة.',
    projects: ['وثيقة متطلبات كاملة مع user stories ومعايير قبول', 'تحليل عملية حالية وتصميم عملية محسنة ونموذج أولي للحل'],
    evidenceKeywords: ['business analyst', 'systems analyst', 'requirements', 'stakeholder', 'process model', 'user stories', 'تحليل أعمال', 'تحليل نظم', 'متطلبات', 'أصحاب المصلحة'],
    majorKeywords: [...sharedMajors, 'information systems', 'business analysis', 'management information systems', 'نظم المعلومات', 'تحليل الأعمال'],
    sources: [
      { label: 'O*NET — Computer Systems Analysts', url: 'https://www.onetonline.org/link/summary/15-1211.00' },
      { label: 'IIBA — Entry Certificate in Business Analysis', url: 'https://www.iiba.org/ecba/' },
    ],
  },
};
