export type ProfessionalCertification = {
  id: string;
  careerId: string;
  title: string;
  provider: string;
  url: string;
  level: string;
  cost: string;
  note: string;
};

export const professionalCertifications: ProfessionalCertification[] = [
  {
    id: 'github-foundations', careerId: 'C01', title: 'GitHub Foundations', provider: 'GitHub',
    url: 'https://learn.github.com/certifications', level: 'تأسيسي',
    cost: 'اختبار مهني مدفوع؛ تحقّق من السعر الحالي قبل التسجيل',
    note: 'مساندة لهندسة البرمجيات وإدارة المصدر، وليست شرطًا عامًا لكل وظيفة برمجية.',
  },
  {
    id: 'microsoft-pl-300', careerId: 'C02', title: 'Power BI Data Analyst Associate (PL-300)', provider: 'Microsoft',
    url: 'https://learn.microsoft.com/en-us/credentials/certifications/data-analyst-associate/', level: 'متوسط',
    cost: 'الاختبار مدفوع ويختلف سعره حسب البلد',
    note: 'مرتبطة بتحضير البيانات ونمذجتها وتصويرها وتحليلها باستخدام Power BI.',
  },
  {
    id: 'databricks-ml-associate', careerId: 'C03', title: 'Machine Learning Associate', provider: 'Databricks',
    url: 'https://www.databricks.com/learn/certification/machine-learning-associate', level: 'مشارك',
    cost: 'الاختبار مدفوع؛ تحقّق من السعر الحالي قبل التسجيل',
    note: 'تقيس تنفيذ مهام تعلم آلة أساسية، ويُوصى بخبرة عملية قبل الاختبار. ليست شرطًا عامًا لوظائف علم البيانات.',
  },
  {
    id: 'aws-ml-engineer-associate', careerId: 'C04', title: 'Machine Learning Engineer – Associate (MLA-C02)', provider: 'AWS',
    url: 'https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/', level: 'مشارك',
    cost: 'الاختبار مدفوع؛ النسخة MLA-C02 كانت بسعر تجريبي وقت المراجعة، فتحقّق من السعر والحالة الحالية',
    note: 'تقيس تجهيز البيانات وبناء حلول AI/ML ونشرها وتشغيلها ومراقبتها على AWS، ويوصي المزود بخبرة عملية.',
  },
  {
    id: 'google-professional-ml-engineer', careerId: 'C04', title: 'Professional Machine Learning Engineer', provider: 'Google Cloud',
    url: 'https://cloud.google.com/learn/certification/machine-learning-engineer', level: 'احترافي متقدم',
    cost: '200 دولار أمريكي إضافة إلى الضرائب بحسب صفحة المزود؛ تحقّق قبل التسجيل',
    note: 'خيار متقدم لمن يستخدم Google Cloud، ويوصي المزود بخبرة عملية. يكفي للمسار الحصول على إحدى الشهادات المقترحة.',
  },
  {
    id: 'isc2-cc', careerId: 'C05', title: 'Certified in Cybersecurity (CC)', provider: 'ISC2',
    url: 'https://www.isc2.org/certifications/cc', level: 'تأسيسي',
    cost: 'قد تتوفر عروض تدريب أو اختبار؛ تحقّق من السعر ورسوم التجديد الحالية قبل التسجيل',
    note: 'مدخل تأسيسي للأمن السيبراني ولا يشترط خبرة عمل بحسب صفحة الجهة. ليست شرطًا عامًا للتوظيف.',
  },
  {
    id: 'comptia-security-plus', careerId: 'C05', title: 'CompTIA Security+', provider: 'CompTIA',
    url: 'https://www.comptia.org/en-us/certifications/security/', level: 'تأسيسي إلى متوسط',
    cost: 'الاختبار مدفوع؛ تحقّق من السعر الحالي والخصومات الأكاديمية قبل الشراء',
    note: 'تغطي أساسيات التهديدات والعمارة الأمنية والعمليات والمخاطر، وتدعم المسار ولا تعوض المختبر العملي.',
  },
  {
    id: 'microsoft-sc-200', careerId: 'C05', title: 'Security Operations Analyst Associate (SC-200)', provider: 'Microsoft',
    url: 'https://learn.microsoft.com/en-us/credentials/certifications/security-operations-analyst/', level: 'متوسط',
    cost: 'الاختبار مدفوع ويختلف سعره حسب البلد',
    note: 'تركز على التحقيق في التهديدات والاستجابة للحوادث باستخدام أدوات Microsoft الأمنية.',
  },
  {
    id: 'comptia-network-plus', careerId: 'C06', title: 'CompTIA Network+', provider: 'CompTIA',
    url: 'https://www.comptia.org/en-us/certifications/network/', level: 'تأسيسي',
    cost: 'الاختبار مدفوع؛ تحقّق من السعر الحالي والخصومات الأكاديمية قبل الشراء',
    note: 'خيار تأسيسي محايد للمزود في الشبكات. CCNA أكثر ارتباطًا ببيئة Cisco، ويكفي اختيار الأنسب لهدفك.',
  },
  {
    id: 'cisco-ccna', careerId: 'C06', title: 'Cisco Certified Network Associate (CCNA)', provider: 'Cisco',
    url: 'https://www.cisco.com/site/us/en/learn/training-certifications/certifications/enterprise/ccna/index.html', level: 'مشارك',
    cost: '300 دولار أمريكي بحسب صفحة Cisco، وقد تختلف الضرائب',
    note: 'تغطي أساسيات الشبكات والوصول وIP والأمن والأتمتة، ولا توجد متطلبات سابقة للاختبار.',
  },
  {
    id: 'microsoft-dp-700', careerId: 'C07', title: 'Fabric Data Engineer Associate (DP-700)', provider: 'Microsoft',
    url: 'https://learn.microsoft.com/en-us/credentials/certifications/fabric-data-engineer-associate/', level: 'متوسط',
    cost: 'الاختبار مدفوع ويختلف سعره حسب البلد؛ صفحة المزود تعرض السعر قبل الحجز',
    note: 'مرتبطة بإدخال البيانات وتحويلها وتأمين حلول التحليلات ومراقبتها باستخدام Microsoft Fabric.',
  },
  {
    id: 'google-professional-data-engineer', careerId: 'C07', title: 'Professional Data Engineer', provider: 'Google Cloud',
    url: 'https://cloud.google.com/learn/certification/data-engineer', level: 'احترافي متقدم',
    cost: '200 دولار أمريكي إضافة إلى الضرائب بحسب صفحة المزود؛ تحقّق قبل التسجيل',
    note: 'خيار متقدم؛ Google توصي بخبرة عملية واسعة. يكفي للمسار الحصول على إحدى الشهادات المقترحة.',
  },
  {
    id: 'aws-cloud-practitioner', careerId: 'C08', title: 'AWS Certified Cloud Practitioner', provider: 'AWS',
    url: 'https://aws.amazon.com/certification/certified-cloud-practitioner/', level: 'تأسيسي',
    cost: 'الاختبار مدفوع؛ تحقّق من السعر الحالي قبل التسجيل',
    note: 'شهادة تأسيسية للسحابة. تدعم البداية لكنها لا تثبت وحدها مهارات DevOps العملية أو بناء خطوط CI/CD.',
  },
  {
    id: 'iiba-ecba', careerId: 'C09', title: 'Entry Certificate in Business Analysis (ECBA)', provider: 'IIBA',
    url: 'https://www.iiba.org/ecba/', level: 'تأسيسي',
    cost: 'مدفوعة؛ توجد أسعار وخصومات للطلاب حسب المنطقة، فتحقّق قبل الشراء',
    note: 'تثبت المعرفة التأسيسية في تحليل الأعمال ولا تتطلب خبرة محددة للتقدم وفق صفحة IIBA.',
  },
  {
    id: 'istqb-ctfl', careerId: 'C01', title: 'Certified Tester Foundation Level (CTFL)', provider: 'ISTQB',
    url: 'https://www.istqb.org/certifications/certified-tester-foundation-level', level: 'تأسيسي لمسار الاختبار',
    cost: 'الاختبار مدفوع ويختلف حسب الجهة المحلية المعتمدة',
    note: 'مقترحة لمساري QA Engineer وSoftware Test Engineer تحديدًا، وليست مطلوبة لبقية وظائف البرمجة.',
  },
  {
    id: 'comptia-a-plus', careerId: 'C08', title: 'CompTIA A+', provider: 'CompTIA',
    url: 'https://www.comptia.org/en-us/certifications/a/', level: 'تأسيسي للدعم الفني',
    cost: 'الاختباران مدفوعان؛ تحقّق من السعر والخصم الأكاديمي',
    note: 'مناسبة للدعم الفني والأجهزة وأنظمة التشغيل واستكشاف الأعطال، ولا تفيد كل مسارات تقنية المعلومات بالقدر نفسه.',
  },
  {
    id: 'microsoft-az-104', careerId: 'C08', title: 'Azure Administrator Associate (AZ-104)', provider: 'Microsoft',
    url: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-administrator/', level: 'متوسط',
    cost: 'الاختبار مدفوع ويختلف سعره حسب البلد',
    note: 'مرتبطة بإدارة Azure والهوية والتخزين والحوسبة والشبكات والمراقبة، ومناسبة لمسارات الإدارة والبنية السحابية.',
  },
  {
    id: 'aws-solutions-architect-associate', careerId: 'C08', title: 'AWS Solutions Architect – Associate', provider: 'AWS',
    url: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/', level: 'مشارك',
    cost: '150 دولارًا أمريكيًا بحسب صفحة AWS وقت المراجعة؛ تحقّق قبل التسجيل',
    note: 'مناسبة بعد تدريب عملي على تصميم حلول AWS. AWS توصي بخبرة عملية قبل الاختبار، لذلك ليست خطوة أولى إلزامية للخريج.',
  },
  {
    id: 'aws-developer-associate', careerId: 'C01', title: 'AWS Certified Developer – Associate', provider: 'AWS',
    url: 'https://aws.amazon.com/certification/certified-developer-associate/', level: 'مشارك',
    cost: 'الاختبار مدفوع؛ تحقّق من السعر الحالي قبل التسجيل',
    note: 'تفيد مطوري الخدمات الخلفية والسحابية بعد بناء تطبيقات فعلية على AWS، ولا تعوض أساسيات البرمجة.',
  },
  {
    id: 'cisco-ccna-automation', careerId: 'C08', title: 'CCNA Automation', provider: 'Cisco',
    url: 'https://www.cisco.com/site/us/en/learn/training-certifications/certifications/automation/ccna-automation/index.html', level: 'مشارك',
    cost: '300 دولار أمريكي بحسب صفحة Cisco، وقد تختلف الضرائب',
    note: 'مرتبطة بالبرمجة وواجهات API وأتمتة البنية. مناسبة لـ DevOps وIoT أو أتمتة الشبكات بعد ممارسة عملية.',
  },
  {
    id: 'microsoft-dp-900', careerId: 'C07', title: 'Azure Data Fundamentals (DP-900)', provider: 'Microsoft',
    url: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-data-fundamentals/', level: 'تأسيسي',
    cost: 'الاختبار مدفوع ويختلف سعره حسب البلد',
    note: 'تأسيسية لمفاهيم البيانات العلائقية وغير العلائقية والتحليلات على Azure، ومناسبة كبداية لمسار قواعد البيانات.',
  },
  {
    id: 'offsec-oscp', careerId: 'C05', title: 'OffSec Certified Professional (OSCP)', provider: 'OffSec',
    url: 'https://www.offsec.com/courses/pen-200/', level: 'متقدم وعملي',
    cost: 'تدريب واختبار مدفوعان؛ راجع الباقات الحالية لدى OffSec',
    note: 'خيار متقدم لمسار Penetration Tester بعد تأسيس الشبكات والأنظمة ومختبرات قانونية كثيرة، وليس مطلوبًا كبداية.',
  },
];

export const professionalCertificationIds = new Set(professionalCertifications.map(item => item.id));

const englishCertificationDetails: Record<string, Pick<ProfessionalCertification, 'level' | 'cost' | 'note'>> = {
  'github-foundations': { level: 'Foundation', cost: 'Paid exam; check the current price before registering.', note: 'Supports software engineering and source control, but is not a general requirement for software roles.' },
  'microsoft-pl-300': { level: 'Intermediate', cost: 'Paid exam; price varies by country.', note: 'Covers preparing, modeling, visualizing, and analyzing data with Power BI.' },
  'databricks-ml-associate': { level: 'Associate', cost: 'Paid exam; check the current price before registering.', note: 'Assesses foundational machine-learning tasks. Practical experience is recommended; it is not a general requirement for data-science roles.' },
  'aws-ml-engineer-associate': { level: 'Associate', cost: 'Paid exam. MLA-C02 had a promotional price when reviewed; verify the current price and status.', note: 'Covers preparing data, building AI/ML solutions, and deploying, operating, and monitoring them on AWS. The provider recommends practical experience.' },
  'google-professional-ml-engineer': { level: 'Advanced professional', cost: 'US$200 plus applicable tax according to the provider; verify before registering.', note: 'An advanced option for Google Cloud users. The provider recommends practical experience; one of the suggested certifications is enough for this path.' },
  'isc2-cc': { level: 'Foundation', cost: 'Training or exam offers may be available; check current exam and renewal fees.', note: 'An introductory cybersecurity certification. The provider says work experience is not required; it is not a general hiring requirement.' },
  'comptia-security-plus': { level: 'Foundation to intermediate', cost: 'Paid exam; check current pricing and academic discounts before purchasing.', note: 'Covers threats, security architecture, operations, and risk. It supports the path but does not replace hands-on labs.' },
  'microsoft-sc-200': { level: 'Intermediate', cost: 'Paid exam; price varies by country.', note: 'Focuses on threat investigation and incident response with Microsoft security tools.' },
  'comptia-network-plus': { level: 'Foundation', cost: 'Paid exam; check current pricing and academic discounts before purchasing.', note: 'A vendor-neutral networking foundation. CCNA is more relevant to Cisco environments; choose the option that fits your goal.' },
  'cisco-ccna': { level: 'Associate', cost: 'US$300 according to Cisco; taxes may vary.', note: 'Covers networking, access, IP connectivity, security, and automation fundamentals. No prerequisites are required for the exam.' },
  'microsoft-dp-700': { level: 'Intermediate', cost: 'Paid exam; price varies by country. The provider shows the price before booking.', note: 'Covers ingesting and transforming data, securing analytics solutions, and monitoring them with Microsoft Fabric.' },
  'google-professional-data-engineer': { level: 'Advanced professional', cost: 'US$200 plus applicable tax according to the provider; verify before registering.', note: 'An advanced option; Google recommends substantial practical experience. One of the suggested certifications is enough for this path.' },
  'aws-cloud-practitioner': { level: 'Foundation', cost: 'Paid exam; check the current price before registering.', note: 'A cloud foundation certification. It can support an initial learning path but does not prove hands-on DevOps or CI/CD skills.' },
  'iiba-ecba': { level: 'Foundation', cost: 'Paid; student pricing and discounts vary by region, so verify before purchase.', note: 'Shows foundational business-analysis knowledge. According to IIBA, specific work experience is not required to apply.' },
  'istqb-ctfl': { level: 'Testing foundation', cost: 'Paid exam; price varies by accredited local provider.', note: 'Suggested specifically for QA Engineer and Software Test Engineer paths; it is not required for other software roles.' },
  'comptia-a-plus': { level: 'Technical-support foundation', cost: 'Both exams are paid; check current pricing and academic discounts.', note: 'Relevant to technical support, devices, operating systems, and troubleshooting. It is not equally useful across all IT paths.' },
  'microsoft-az-104': { level: 'Intermediate', cost: 'Paid exam; price varies by country.', note: 'Covers Azure administration, identity, storage, compute, networking, and monitoring; it fits administration and cloud infrastructure paths.' },
  'aws-solutions-architect-associate': { level: 'Associate', cost: 'US$150 according to AWS when reviewed; verify the current price.', note: 'Best considered after hands-on AWS solution design practice. AWS recommends practical experience, so it is not a required first step for graduates.' },
  'aws-developer-associate': { level: 'Associate', cost: 'Paid exam; check the current price before registering.', note: 'Useful to backend and cloud developers after building real AWS applications; it does not replace programming fundamentals.' },
  'cisco-ccna-automation': { level: 'Associate', cost: 'US$300 according to Cisco; taxes may vary.', note: 'Covers programming, APIs, and infrastructure automation. It can support DevOps, IoT, or network-automation paths after practical work.' },
  'microsoft-dp-900': { level: 'Foundation', cost: 'Paid exam; price varies by country.', note: 'Introduces relational and non-relational data and analytics on Azure; it can be a starting point for database paths.' },
  'offsec-oscp': { level: 'Advanced and practical', cost: 'Training and exam are paid; check OffSec for current packages.', note: 'An advanced penetration-testing option after networking, systems, and extensive legal lab practice. It is not a beginner requirement.' },
};

export function professionalCertificationCopy(item: ProfessionalCertification, english: boolean): ProfessionalCertification {
  return english ? { ...item, ...englishCertificationDetails[item.id] } : item;
}

export function certificationsForCareer(careerId: string) {
  return professionalCertifications.filter(item => item.careerId === careerId);
}

export function certificationsByIds(ids: string[]) {
  const wanted = new Set(ids);
  return professionalCertifications.filter(item => wanted.has(item.id));
}
