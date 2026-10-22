export type JobTitleOption = { title: string; stage: 'entry' | 'experienced' };
export type AcademicProgram = {
  id: 'computer-science' | 'information-technology' | 'information-systems' | 'software-engineering' | 'computer-engineering' | 'cybersecurity' | 'artificial-intelligence' | 'data-science';
  title: string; englishTitle: string; degree: string; summary: string; careerIds: string[];
  commonTitles: JobTitleOption[]; academicSkills: string[]; recommendedCertificationIds: string[];
  portfolioIdeas: string[]; sources: { label: string; url: string }[];
};
const entry = (title: string): JobTitleOption => ({ title, stage: 'entry' });
const experienced = (title: string): JobTitleOption => ({ title, stage: 'experienced' });
const futureSkills = { label: 'مهارات المستقبل — مجالات التوظيف الرقمية', url: 'https://futureskills.mcit.gov.sa/en/Employment' };
const acm = { label: 'ACM — إرشادات تخصصات الحاسب', url: 'https://ccecc.acm.org/guidance' };
export const academicPrograms: AcademicProgram[] = [
  {
    id: 'computer-science', title: 'علوم الحاسب', englishTitle: 'Computer Science', degree: 'Bachelor of Computer Science',
    summary: 'تخصص واسع في البرمجة والخوارزميات وبناء الأنظمة، ويمكن لخريجه التوجه إلى تطوير البرمجيات والويب والجوال وتحليل الأنظمة.', careerIds: ['C01', 'C09', 'C07', 'C03'],
    commonTitles: [entry('Software Developer'), entry('Software Engineer'), entry('Web Developer'), experienced('Full-Stack Developer'), entry('Back-End Developer'), entry('Mobile Application Developer'), entry('Systems Analyst')],
    academicSkills: ['البرمجة بلغة مثل Java أو Python أو C++', 'هياكل البيانات والخوارزميات', 'قواعد البيانات وSQL', 'تطوير الويب وواجهات API', 'Git وإدارة الإصدارات', 'اكتشاف الأخطاء وإصلاحها', 'أنظمة التشغيل والشبكات'],
    recommendedCertificationIds: ['github-foundations', 'aws-cloud-practitioner'], portfolioIdeas: ['تطبيق كامل بواجهة وAPI وقاعدة بيانات', 'مشروع برمجي موثق على GitHub مع اختبارات آلية وإصلاح أخطاء'], sources: [acm, futureSkills],
  },
  {
    id: 'information-technology', title: 'تقنية المعلومات', englishTitle: 'Information Technology', degree: 'Bachelor of Information Technology',
    summary: 'يركز على تشغيل الأنظمة والشبكات والبنية التحتية والخدمات التقنية داخل الجهات.', careerIds: ['C08', 'C06', 'C05', 'C09'],
    commonTitles: [entry('IT Specialist'), entry('IT Support Specialist'), experienced('Systems Administrator'), experienced('Network Administrator'), entry('IT Operations Specialist'), entry('Cloud Support Specialist'), experienced('IT Infrastructure Specialist')],
    academicSkills: ['دعم المستخدمين وتشخيص الأعطال', 'إدارة Windows وLinux', 'أساسيات الشبكات وTCP/IP', 'الحوسبة السحابية', 'إدارة الحسابات والصلاحيات', 'البرمجة النصية والأتمتة', 'توثيق الحوادث والخدمات'],
    recommendedCertificationIds: ['comptia-network-plus', 'cisco-ccna', 'aws-cloud-practitioner'], portfolioIdeas: ['مختبر دعم تقني يوثق الأعطال والحلول', 'بنية سحابية صغيرة مع مستخدمين وصلاحيات ومراقبة'], sources: [acm, futureSkills],
  },
  {
    id: 'information-systems', title: 'نظم المعلومات', englishTitle: 'Information Systems', degree: 'Bachelor of Information Systems',
    summary: 'يربط التقنية باحتياجات الأعمال، ويهتم بتحليل المتطلبات والعمليات والبيانات والأنظمة المؤسسية.', careerIds: ['C09', 'C02', 'C07'],
    commonTitles: [entry('Systems Analyst'), entry('Business Analyst'), entry('Business Systems Analyst'), experienced('ERP Specialist'), entry('Database Specialist'), entry('Business Intelligence (BI) Analyst'), entry('IT Project Coordinator')],
    academicSkills: ['تحليل المتطلبات والعمليات', 'نمذجة الأنظمة وUML', 'قواعد البيانات وSQL', 'ذكاء الأعمال ولوحات المعلومات', 'كتابة حالات الاستخدام والتوثيق', 'أساسيات ERP', 'إدارة المشاريع والتواصل مع أصحاب المصلحة'],
    recommendedCertificationIds: ['iiba-ecba', 'microsoft-pl-300', 'microsoft-dp-700'], portfolioIdeas: ['تحليل نظام لجهة وكتابة المتطلبات والمخططات', 'لوحة معلومات تربط مؤشرات الأعمال بقرارات واضحة'], sources: [acm, futureSkills],
  },
  {
    id: 'software-engineering', title: 'هندسة البرمجيات', englishTitle: 'Software Engineering', degree: 'Bachelor of Software Engineering',
    summary: 'يركز على دورة تطوير المنتج البرمجي من المتطلبات والبناء إلى الجودة والتسليم والعمل الجماعي.', careerIds: ['C01', 'C08'],
    commonTitles: [entry('Software Engineer'), entry('Front-End Developer'), entry('Back-End Developer'), experienced('Full-Stack Developer'), entry('Mobile Developer'), entry('QA Engineer'), entry('Software Test Engineer'), experienced('DevOps Engineer')],
    academicSkills: ['البرمجة الكائنية وهياكل البيانات', 'تحليل المتطلبات', 'بناء واجهات المستخدم وواجهات API', 'تصميم قواعد البيانات', 'Git والعمل الجماعي', 'كتابة اختبارات آلية بأدوات مثل Jest', 'CI/CD ونشر التطبيقات'],
    recommendedCertificationIds: ['github-foundations', 'aws-cloud-practitioner'], portfolioIdeas: ['منتج برمجي جماعي من المتطلبات حتى النشر', 'تطبيق يحتوي اختبارات آلية وتتبعًا للأخطاء وطلبات دمج'], sources: [acm, futureSkills],
  },
  {
    id: 'computer-engineering', title: 'هندسة الحاسب', englishTitle: 'Computer Engineering', degree: 'Bachelor of Computer Engineering',
    summary: 'يجمع العتاد والبرمجيات والاتصالات، ويقود إلى الأنظمة المدمجة وإنترنت الأشياء والبرمجيات القريبة من العتاد.', careerIds: ['C06', 'C01', 'C08'],
    commonTitles: [entry('Computer Engineer'), entry('Hardware Engineer'), entry('Embedded Systems Engineer'), entry('IoT Engineer'), entry('Firmware Engineer'), experienced('Network Engineer'), experienced('Systems Engineer')],
    academicSkills: ['المنطق والدوائر الرقمية', 'معمارية الحاسب', 'C وC++', 'المعالجات والأنظمة المدمجة', 'الإلكترونيات وواجهات العتاد', 'الشبكات والاتصالات', 'قراءة المخططات وتشخيص الأعطال'],
    recommendedCertificationIds: ['cisco-ccna', 'comptia-network-plus'], portfolioIdeas: ['نظام مدمج أو جهاز IoT موثق', 'مشروع Firmware يتعامل مع حساسات واتصالات وأخطاء'], sources: [acm, futureSkills],
  },
  {
    id: 'cybersecurity', title: 'الأمن السيبراني', englishTitle: 'Cybersecurity', degree: 'Bachelor of Cybersecurity',
    summary: 'يركز على حماية الأنظمة والبيانات واكتشاف التهديدات والاستجابة للحوادث ضمن مسارات دفاعية واختبارية وتحقيقية.', careerIds: ['C05', 'C06', 'C08'],
    commonTitles: [entry('Cybersecurity Analyst'), entry('SOC Analyst'), experienced('Security Engineer'), experienced('Penetration Tester'), entry('Information Security Analyst'), experienced('Incident Response Analyst'), experienced('Digital Forensics Analyst')],
    academicSkills: ['أمن الشبكات والأنظمة', 'Linux وWindows', 'تحليل السجلات وSIEM', 'إدارة الثغرات', 'الاستجابة للحوادث', 'التشفير والبرمجة الآمنة', 'الحوكمة والمخاطر والالتزام'],
    recommendedCertificationIds: ['isc2-cc', 'comptia-security-plus', 'microsoft-sc-200'], portfolioIdeas: ['مختبر SOC قانوني مع تقرير حادث', 'تحليل ثغرات لنظام تملكه مع خطة معالجة'], sources: [{ label: 'الهيئة الوطنية للأمن السيبراني — الإطار السعودي لكوادر الأمن السيبراني', url: 'https://nca.gov.sa/en/services/interactive-scywf-framework/' }, futureSkills],
  },
  {
    id: 'artificial-intelligence', title: 'الذكاء الاصطناعي', englishTitle: 'Artificial Intelligence', degree: 'Bachelor of Artificial Intelligence',
    summary: 'يجمع البرمجة والرياضيات والبيانات لبناء نماذج ذكية وتقييمها ونشرها.', careerIds: ['C04', 'C03', 'C07', 'C02'],
    commonTitles: [experienced('AI Engineer'), experienced('Machine Learning Engineer'), experienced('NLP Engineer'), experienced('Computer Vision Engineer'), entry('AI Developer'), experienced('Generative AI Engineer'), entry('AI Research Assistant')],
    academicSkills: ['Python', 'الجبر الخطي والاحتمالات والإحصاء', 'تنظيف البيانات وتحليلها', 'تعلم الآلة وتقييم النماذج', 'التعلم العميق', 'معالجة اللغة أو الرؤية الحاسوبية', 'نشر النماذج وMLOps'],
    recommendedCertificationIds: ['databricks-ml-associate', 'aws-ml-engineer-associate', 'google-professional-ml-engineer'], portfolioIdeas: ['نموذج يحل مشكلة حقيقية مع مقاييس واضحة', 'تطبيق AI منشور يوضح البيانات وحدود النموذج'], sources: [{ label: 'سدايا — المعايير المهنية الوطنية للبيانات والذكاء الاصطناعي', url: 'https://sdaia.gov.sa/en/Research/Pages/NOSF.aspx' }, futureSkills],
  },
  {
    id: 'data-science', title: 'علم البيانات', englishTitle: 'Data Science', degree: 'Bachelor of Data Science',
    summary: 'يركز على جمع البيانات وتنظيفها وتحليلها وبناء نماذج منها وعرض النتائج لدعم القرار.', careerIds: ['C02', 'C03', 'C07', 'C04'],
    commonTitles: [entry('Data Analyst'), experienced('Data Scientist'), experienced('Data Engineer'), entry('BI Analyst'), experienced('Machine Learning Engineer'), entry('Data Visualization Specialist'), entry('Junior Data Scientist')],
    academicSkills: ['Python أو R', 'SQL وقواعد البيانات', 'الإحصاء والاحتمالات', 'تنظيف البيانات وتحليلها', 'تصوير البيانات وبناء اللوحات', 'تعلم الآلة وتقييم النماذج', 'شرح النتائج لأصحاب القرار'],
    recommendedCertificationIds: ['microsoft-pl-300', 'databricks-ml-associate', 'microsoft-dp-700'], portfolioIdeas: ['تحليل بيانات حقيقية مع لوحة معلومات', 'مشروع تنبؤ يقارن النماذج ويشرح النتائج والحدود'], sources: [{ label: 'سدايا — المعايير المهنية الوطنية للبيانات والذكاء الاصطناعي', url: 'https://sdaia.gov.sa/en/Research/Pages/NOSF.aspx' }, futureSkills],
  },
];
export const academicProgramTitles = academicPrograms.map(program => program.title);
