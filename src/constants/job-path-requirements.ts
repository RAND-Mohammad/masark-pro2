import dataset from '../masarak_dataset.json';
import { jobPathById } from './job-paths';

export type JobPathRequirementProfile = {
  coreSkillNames: string[];
  additionalSkillNames: string[];
  certificationIds: string[];
  education: string;
  experience: string;
  projects: string[];
  evidenceKeywords: string[];
  sources: { label: string; url: string }[];
  weights: { skills: number; practical: number; certifications: number; academic: number; learning: number };
};

type Template = Omit<JobPathRequirementProfile, 'education' | 'sources' | 'weights'>;

const sfia = { label: 'إطار SFIA 9 للمهارات والأدوار الرقمية', url: 'https://sfia-online.org/en/sfia-9' };
const scywf = { label: 'الإطار السعودي للقوى العاملة في الأمن السيبراني', url: 'https://nca.gov.sa/en/regulatory-documents/frameworks-and-standard-list/scywf/' };
const sdaia = { label: 'المعايير المهنية الوطنية للبيانات والذكاء الاصطناعي', url: 'https://sdaia.gov.sa/en/Research/Pages/NOSF.aspx' };

const templates: Record<string, Template> = {
  software: {
    coreSkillNames: ['Programming', 'Applications development', 'Software design', 'Software requirements analysis', 'Version control/source code management tools usage', 'Software debugging'],
    additionalSkillNames: ['Developing APIs', 'Database design', 'Continuous integration and continuous deployment'],
    certificationIds: ['github-foundations'], experience: 'مشروعان برمجيان مكتملان على الأقل مع مستودع كود واختبارات وتوثيق.',
    projects: ['تطبيق كامل يبدأ من المتطلبات وينتهي بالنشر', 'مساهمة موثقة في مشروع جماعي باستخدام Git'], evidenceKeywords: ['software', 'application', 'تطبيق', 'برمج', 'github'],
  },
  web: {
    coreSkillNames: ['Programming', 'Dynamic websites development', 'Front-end technologies', 'Backend design', 'Developing APIs', 'Database design'],
    additionalSkillNames: ['Web-based solution architecture', 'Quality assurance for websites', 'Version control/source code management tools usage'],
    certificationIds: ['github-foundations'], experience: 'موقع ويب متجاوب متصل بواجهة API وقاعدة بيانات، منشور وله مستودع كود.',
    projects: ['تطبيق ويب كامل مع تسجيل دخول', 'واجهة متجاوبة مع اختبارات وصول وأداء'], evidenceKeywords: ['web', 'website', 'frontend', 'backend', 'full-stack', 'ويب'],
  },
  frontend: {
    coreSkillNames: ['Front-end technologies', 'Markup language usage', 'Programming', 'User interface assets design', 'Dynamic websites development', 'Quality assurance for websites'],
    additionalSkillNames: ['Web and mobile design', 'Prototyping tools and processes', 'Version control/source code management tools usage'],
    certificationIds: ['github-foundations'], experience: 'واجهتان متجاوبتان على الأقل مع إدارة حالة، استهلاك API، واختبارات واجهة.',
    projects: ['لوحة تحكم متجاوبة', 'تحويل تصميم إلى واجهة قابلة للاستخدام'], evidenceKeywords: ['frontend', 'front-end', 'react', 'واجهة', 'web'],
  },
  backend: {
    coreSkillNames: ['Backend design', 'Programming', 'Developing APIs', 'Database design', 'Software testing', 'Application vulnerability assessment'],
    additionalSkillNames: ['Cloud-based microservices architecture development', 'Applications performance monitoring', 'Continuous integration and continuous deployment'],
    certificationIds: ['github-foundations', 'aws-developer-associate'], experience: 'خدمة خلفية موثقة بقاعدة بيانات وAPI واختبارات وصلاحيات ومراقبة.',
    projects: ['REST API آمنة وموثقة', 'خدمة خلفية منشورة مع اختبارات آلية'], evidenceKeywords: ['backend', 'back-end', 'api', 'database', 'خلفية'],
  },
  mobile: {
    coreSkillNames: ['Mobile application development', 'Programming', 'Mobile-based solution architecture', 'Software testing', 'Software debugging', 'Developing APIs'],
    additionalSkillNames: ['Mobile web development or cloud app development knowledge', 'User interface assets design', 'Version control/source code management tools usage'],
    certificationIds: ['github-foundations', 'aws-developer-associate'], experience: 'تطبيق جوال يعمل على جهاز حقيقي ويتعامل مع التخزين وAPI وحالات الخطأ.',
    projects: ['تطبيق جوال منشور كتجربة داخلية', 'ميزة جوال متكاملة مع خدمة خلفية'], evidenceKeywords: ['mobile', 'android', 'ios', 'react native', 'flutter', 'جوال'],
  },
  qa: {
    coreSkillNames: ['Software testing', 'Test planning', 'Test case validation', 'Acceptance testing', 'Software debugging', 'Software quality guidelines development'],
    additionalSkillNames: ['Continuous integration and continuous deployment', 'Quality assurance for websites', 'Reporting and documentation'],
    certificationIds: ['istqb-ctfl'], experience: 'خطة اختبار وحالات اختبار وتقارير عيوب واختبارات آلية لمنتج حقيقي أو تدريبي.',
    projects: ['اختبار شامل لتطبيق مع تقرير عيوب', 'حزمة اختبارات آلية تعمل ضمن CI'], evidenceKeywords: ['qa', 'test', 'quality', 'اختبار', 'جودة'],
  },
  business: {
    coreSkillNames: ['Business analysis', 'Business requirements mapping', 'Requirements definition and management', 'User requirements interpretation', 'Stakeholder management', 'Reporting and documentation'],
    additionalSkillNames: ['Business process re-engineering', 'Data visualisation and storyboarding', 'ICT project management'],
    certificationIds: ['iiba-ecba'], experience: 'تحليل حالة أعمال فعلية وكتابة متطلبات وقصص مستخدم ونماذج عمليات قابلة للمراجعة.',
    projects: ['وثيقة متطلبات ونموذج عمليات', 'تحليل أصحاب المصلحة وحالة العمل'], evidenceKeywords: ['business', 'requirements', 'stakeholder', 'متطلبات', 'عمليات'],
  },
  systems: {
    coreSkillNames: ['Business analysis', 'Software requirements analysis', 'Requirements definition and management', 'User requirements interpretation', 'System administration', 'Reporting and documentation'],
    additionalSkillNames: ['Business requirements mapping', 'ICT project management', 'Data management'],
    certificationIds: ['iiba-ecba'], experience: 'تحليل نظام قائم واقتراح حل تقني موثق يربط حاجة العمل بالمكونات والبيانات.',
    projects: ['تحليل وتصميم نظام معلومات', 'دراسة فجوة لنظام قائم'], evidenceKeywords: ['system', 'requirements', 'analysis', 'نظام', 'متطلبات'],
  },
  erp: {
    coreSkillNames: ['Enterprise Resource Planning (ERP)', 'Knowledge of ERP systems', 'Business requirements mapping', 'Business process re-engineering', 'Data integration and interoperability', 'Stakeholder management'],
    additionalSkillNames: ['Configuration management', 'User requirements interpretation', 'Reporting and documentation'],
    certificationIds: ['iiba-ecba'], experience: 'سيناريو إعداد وحدة ERP أو تحليل دورة عمل مع ترحيل بيانات واختبار قبول المستخدم.',
    projects: ['تصميم عملية أعمال داخل ERP', 'خطة ترحيل بيانات واختبار قبول'], evidenceKeywords: ['erp', 'sap', 'oracle', 'enterprise', 'موارد'],
  },
  database: {
    coreSkillNames: ['Database design', 'Database management and configuration', 'Database modelling', 'Database requirements analysis', 'Databases maintenance and configuration', 'Data normalisation'],
    additionalSkillNames: ['Network and data security', 'Data warehousing', 'Cloud computing'],
    certificationIds: ['microsoft-dp-900'], experience: 'قاعدة بيانات مصممة ومؤمنة مع نسخ احتياطي واستعلامات وتحسين أداء موثق.',
    projects: ['تصميم قاعدة بيانات مطبعة ومفاتيح وفهارس', 'نسخ احتياطي واستعادة ومراقبة قاعدة بيانات'], evidenceKeywords: ['database', 'sql', 'data model', 'قاعدة بيانات'],
  },
  bi: {
    coreSkillNames: ['Data analytics', 'Data cleaning', 'Data visualisation and storyboarding', 'Data warehousing', 'Statistical analysis', 'Business requirements mapping'],
    additionalSkillNames: ['Database design', 'Data preparation', 'Reporting and documentation'],
    certificationIds: ['microsoft-pl-300'], experience: 'لوحة مؤشرات مرتبطة بأسئلة عمل واضحة، تتضمن تنظيفًا ونمذجةً وتفسيرًا للبيانات.',
    projects: ['لوحة Power BI بمؤشرات قابلة للتتبع', 'تحليل بيانات يجيب عن سؤال أعمال'], evidenceKeywords: ['power bi', 'dashboard', 'analytics', 'bi', 'مؤشر'],
  },
  support: {
    coreSkillNames: ['Computer hardware maintenance', 'Computer operating systems and hardware usage', 'Desktop environment configuration', 'Hardware and software installations', 'Applications support and enhancement', 'Incident management'],
    additionalSkillNames: ['Network support', 'Reporting and documentation', 'IT service incident response management'],
    certificationIds: ['comptia-a-plus'], experience: 'حل مشكلات أجهزة وأنظمة موثق بتذاكر دعم وشرح التشخيص والإجراء والنتيجة.',
    projects: ['مختبر دعم فني وتوثيق عشر حالات', 'إعداد جهاز وهوية وصلاحيات ونسخ احتياطي'], evidenceKeywords: ['support', 'help desk', 'hardware', 'troubleshoot', 'دعم'],
  },
  sysadmin: {
    coreSkillNames: ['System administration', 'Operating systems management', 'Infrastructure management', 'Configuration management', 'Incident management', 'Network administration and maintenance'],
    additionalSkillNames: ['Cloud infrastructure management', 'Business continuity', 'Reporting and documentation'],
    certificationIds: ['microsoft-az-104', 'comptia-network-plus'], experience: 'مختبر خوادم ومستخدمين وصلاحيات ونسخ احتياطي ومراقبة مع توثيق التشغيل.',
    projects: ['بناء بيئة خادم وإدارة المستخدمين', 'خطة نسخ احتياطي وتعافٍ ومراقبة'], evidenceKeywords: ['system administrator', 'server', 'active directory', 'linux', 'خادم'],
  },
  network: {
    coreSkillNames: ['Networking', 'Network configuration', 'Network architecture design and planning', 'Internetwork routing solutions configuration', 'Network security', 'Network support'],
    additionalSkillNames: ['Network administration and maintenance', 'Incident management', 'Cloud computing'],
    certificationIds: ['cisco-ccna', 'comptia-network-plus'], experience: 'مختبر شبكات عملي يتضمن VLAN والتوجيه والعنونة والحماية واستكشاف الأعطال.',
    projects: ['تصميم شبكة مؤسسة صغيرة ومحاكاتها', 'سيناريو استكشاف عطل شبكي موثق'], evidenceKeywords: ['network', 'cisco', 'routing', 'switching', 'شبكة'],
  },
  cloud: {
    coreSkillNames: ['Cloud computing', 'Cloud infrastructure management', 'Cloud environment configuration', 'Cloud services monitoring and configuration', 'Network security', 'Incident management'],
    additionalSkillNames: ['Cloud backup and recovery', 'Configuration management', 'Scripting and programming languages'],
    certificationIds: ['aws-cloud-practitioner', 'aws-solutions-architect-associate', 'microsoft-az-104'], experience: 'بيئة سحابية صغيرة آمنة ومراقبة مع بنية شبكية وتكلفة ونسخ احتياطي موثق.',
    projects: ['نشر تطبيق على السحابة مع مراقبة', 'بنية سحابية آمنة وقابلة للاستعادة'], evidenceKeywords: ['cloud', 'aws', 'azure', 'سحابة'],
  },
  devops: {
    coreSkillNames: ['Continuous integration and continuous deployment', 'Cloud development and operations management', 'Configuration management', 'Release and deployment', 'Scripting and programming languages', 'Infrastructure deployment'],
    additionalSkillNames: ['Applications performance monitoring', 'Incident management', 'Version control/source code management tools usage'],
    certificationIds: ['aws-developer-associate', 'cisco-ccna-automation'], experience: 'خط CI/CD حقيقي ينفذ الاختبارات ويبني وينشر مع مراقبة وخطة رجوع.',
    projects: ['Pipeline آلي لبناء واختبار ونشر تطبيق', 'بنية ككود مع مراقبة وسجل إصدارات'], evidenceKeywords: ['devops', 'ci/cd', 'pipeline', 'docker', 'deploy'],
  },
  hardware: {
    coreSkillNames: ['Hardware design', 'Electronic circuit boards design and integration', 'Electronic logic design', 'Computer hardware maintenance', 'Electronic and mechanical designs validation', 'Embedded hardware development'],
    additionalSkillNames: ['Computer operating systems and hardware usage', 'Embedded systems integration', 'Reporting and documentation'],
    certificationIds: [], experience: 'تصميم أو مختبر عتاد موثق بالقياسات والمخططات والاختبار، فالشهادة المهنية ليست أولوية للخريج هنا.',
    projects: ['لوحة أو دائرة رقمية مع نتائج قياس', 'اختبار تكامل عتاد وبرمجيات'], evidenceKeywords: ['hardware', 'circuit', 'pcb', 'electronic', 'عتاد'],
  },
  embedded: {
    coreSkillNames: ['Embedded systems programming', 'Embedded systems design', 'Embedded software modules design', 'Embedded systems integration', 'Embedded systems interface design', 'Software debugging'],
    additionalSkillNames: ['Embedded firmware development', 'Embedded hardware development', 'Version control/source code management tools usage'],
    certificationIds: [], experience: 'نظام مضمن يعمل على لوحة فعلية مع تعريف الواجهات والاختبارات وقراءة الحساسات.',
    projects: ['نظام حساس وتحكم على متحكم دقيق', 'برنامج مضمن مع اختبارات وتوثيق واجهات'], evidenceKeywords: ['embedded', 'microcontroller', 'arduino', 'firmware', 'مضمن'],
  },
  iot: {
    coreSkillNames: ['IoT solution development', 'IoT devices and network design', 'IoT devices configuration', 'IoT devices troubleshooting', 'Embedded systems programming', 'IoT security and governance'],
    additionalSkillNames: ['Hardware design for IoT solutions', 'Cloud computing', 'Data acquisition system components'],
    certificationIds: ['cisco-ccna-automation'], experience: 'حل IoT متكامل من الجهاز إلى الاتصال والسحابة ولوحة العرض مع ضوابط أمنية.',
    projects: ['حساس متصل يرسل بيانات إلى لوحة متابعة', 'اختبار تهديدات وإجراءات حماية لجهاز IoT'], evidenceKeywords: ['iot', 'sensor', 'mqtt', 'internet of things', 'حساس'],
  },
  cyber: {
    coreSkillNames: ['Cybersecurity analysis', 'Cybersecurity fundamentals', 'Cybersecurity risk assessment', 'Identity and access management', 'Vulnerability assessment and detection', 'Computer network security'],
    additionalSkillNames: ['Cyber incident management', 'Security assessment and testing', 'Reporting and documentation'],
    certificationIds: ['isc2-cc', 'comptia-security-plus'], experience: 'مختبر أمني قانوني مع تحليل مخاطر وثغرات وضوابط وتقرير تنفيذي وتقني.',
    projects: ['تقييم مخاطر وضوابط لنظام', 'مختبر كشف ثغرات ومعالجتها'], evidenceKeywords: ['cyber', 'security', 'vulnerability', 'أمن', 'ثغرات'],
  },
  soc: {
    coreSkillNames: ['Security Operations Center (SOC) Operations', 'Security Information and Event Management', 'Cybersecurity analysis', 'Incident handling methodologies application', 'Vulnerability assessment and detection', 'Network analysis and reconstruction tools usage'],
    additionalSkillNames: ['Endpoint Detection and Response (EDR) Deployment', 'Malware analysis', 'Reporting and documentation'],
    certificationIds: ['microsoft-sc-200', 'comptia-security-plus'], experience: 'مختبر SOC يحلل سجلات وتنبيهات SIEM ويصنف حادثة ويوثق التصعيد والاستجابة.',
    projects: ['تحليل تنبيهات SIEM وبناء قواعد كشف', 'تقرير حادثة من التنبيه إلى الإغلاق'], evidenceKeywords: ['soc', 'siem', 'alert', 'incident', 'تنبيه'],
  },
  securityEngineering: {
    coreSkillNames: ['Cybersecurity systems design assessment', 'Computer network security', 'Identity and access management', 'Cybersecurity control application', 'Cloud security', 'Security assessment and testing'],
    additionalSkillNames: ['Cryptography and encryption', 'Cyber security infrastructure', 'Vulnerability assessment and detection'],
    certificationIds: ['comptia-security-plus', 'cisco-ccna'], experience: 'تصميم أمني لنظام أو شبكة يتضمن نموذج تهديد وضوابط وهوية واختبارات تحقق.',
    projects: ['معمارية أمنية ونموذج تهديد', 'تطبيق ضوابط وصول وشبكة واختبارها'], evidenceKeywords: ['security engineer', 'architecture', 'iam', 'firewall', 'هندسة أمن'],
  },
  pentest: {
    coreSkillNames: ['Penetration testing', 'Organisational penetration testing', 'Application vulnerability assessment', 'Security assessment and testing', 'Vulnerability assessment and detection', 'Reporting and documentation'],
    additionalSkillNames: ['Adversarial simulation', 'Computer network security', 'Scripting and programming languages'],
    certificationIds: ['comptia-security-plus', 'offsec-oscp'], experience: 'مختبرات مصرح بها فقط، مع منهجية واضحة وأدلة وتقرير إصلاح؛ OSCP خيار متقدم بعد التدريب العملي.',
    projects: ['اختبار تطبيق تدريبي قانوني وتقرير احترافي', 'مختبر شبكة مع توثيق الثغرات والإصلاح'], evidenceKeywords: ['penetration', 'pentest', 'ctf', 'burp', 'اختبار اختراق'],
  },
  incident: {
    coreSkillNames: ['Cyber incident management', 'Cyber security incident response planning', 'Incident handling methodologies application', 'Digital forensics', 'Malware analysis', 'Network analysis and reconstruction tools usage'],
    additionalSkillNames: ['Security Information and Event Management', 'Root cause analysis', 'Reporting and documentation'],
    certificationIds: ['microsoft-sc-200', 'comptia-security-plus'], experience: 'تمرين استجابة لحادثة مع خط زمني واحتواء واستئصال واستعادة ودروس مستفادة.',
    projects: ['محاكاة حادثة وكتابة playbook', 'تحليل سجلات وبناء خط زمني للحادثة'], evidenceKeywords: ['incident response', 'forensic', 'malware', 'حادثة'],
  },
  forensics: {
    coreSkillNames: ['Digital forensics', 'Cyber forensics', 'Digital forensics data extraction', 'Forensic analysis', 'Forensic tool suites usage', 'Processing digital evidence'],
    additionalSkillNames: ['Electronic evidence collection and management', 'Memory dumps analysis', 'Reporting and documentation'],
    certificationIds: ['comptia-security-plus'], experience: 'حالة جنائية رقمية تدريبية تحافظ على سلسلة الحيازة وتستخرج الأدلة وتقدم تقريرًا قابلًا للمراجعة.',
    projects: ['تحليل صورة قرص تدريبية مع خط زمني', 'استخراج أدلة وكتابة سلسلة حيازة'], evidenceKeywords: ['forensic', 'evidence', 'memory dump', 'أدلة رقمية'],
  },
  ai: {
    coreSkillNames: ['Programming', 'Machine Learning (ML)', 'Machine learning frameworks application', 'Artificial intelligence, machine learning and deep learning application', 'Data preparation', 'Model lifecycles deployment management'],
    additionalSkillNames: ['AI ethics and governance', 'Data engineering', 'Continuous integration and continuous deployment'],
    certificationIds: ['aws-ml-engineer-associate', 'google-professional-ml-engineer'], experience: 'نموذج AI مبني على بيانات موثقة مع تقييم واضح ونشر ومراقبة وحدود استخدام.',
    projects: ['نموذج تعلم آلة من البيانات إلى النشر', 'تقرير تقييم وانحياز ومراقبة نموذج'], evidenceKeywords: ['ai', 'machine learning', 'model', 'ذكاء', 'تعلم آلة'],
  },
  nlp: {
    coreSkillNames: ['Natural language Processing (NLP)', 'Natural language processing model development', 'Machine Learning (ML)', 'Data preparation', 'Programming', 'Model lifecycles deployment management'],
    additionalSkillNames: ['Artificial intelligence, machine learning and deep learning application', 'AI ethics and governance', 'Data engineering'],
    certificationIds: ['aws-ml-engineer-associate', 'google-professional-ml-engineer'], experience: 'مشروع نصوص عربي أو إنجليزي بتقسيم بيانات صحيح ومقاييس تقييم وتحليل أخطاء.',
    projects: ['تصنيف نصوص أو استخراج معلومات', 'نظام سؤال وجواب مع تقييم موثق'], evidenceKeywords: ['nlp', 'text', 'language model', 'نصوص', 'لغة'],
  },
  vision: {
    coreSkillNames: ['Computer vision technology', 'Machine Learning (ML)', 'Machine learning frameworks application', 'Data preparation', 'Programming', 'Model optimisation'],
    additionalSkillNames: ['Artificial intelligence, machine learning and deep learning application', 'Model lifecycles deployment management', 'AI ethics and governance'],
    certificationIds: ['aws-ml-engineer-associate', 'google-professional-ml-engineer'], experience: 'مشروع صور أو فيديو مع بيانات معنونة ومقاييس تقييم وتحليل فشل وأداء الاستدلال.',
    projects: ['تصنيف أو كشف أجسام في الصور', 'تقييم أداء وانحياز نموذج رؤية'], evidenceKeywords: ['computer vision', 'image', 'opencv', 'رؤية', 'صور'],
  },
  research: {
    coreSkillNames: ['Research', 'Knowledge of hypothesis forming and testing', 'Statistical analysis', 'Machine Learning (ML)', 'Programming', 'Reporting and documentation'],
    additionalSkillNames: ['Data preparation', 'AI ethics and governance', 'Data science principles'],
    certificationIds: [], experience: 'مشاركة بحثية أو مشروع تخرج بمنهجية وسؤال وتجارب قابلة لإعادة الإنتاج؛ الدراسات العليا أقوى من شهادة مهنية عامة لهذا المسار.',
    projects: ['إعادة تنفيذ ورقة وقياس النتائج', 'بحث مصغر بفرضية وتجارب وتقرير'], evidenceKeywords: ['research', 'paper', 'experiment', 'بحث', 'تجربة'],
  },
  dataAnalyst: {
    coreSkillNames: ['Data analytics', 'Data cleaning', 'Data collection and analysis', 'Data visualisation and storyboarding', 'Statistical analysis', 'Data preparation'],
    additionalSkillNames: ['Database design', 'Reporting and documentation', 'Programming'],
    certificationIds: ['microsoft-pl-300'], experience: 'تحليل مجموعة بيانات حقيقية وتنظيفها وتفسيرها في تقرير أو لوحة مؤشرات موجهة لقرار.',
    projects: ['تحليل بيانات من السؤال إلى التوصية', 'لوحة مؤشرات مع تعريف المقاييس'], evidenceKeywords: ['data analysis', 'analytics', 'dashboard', 'تحليل بيانات'],
  },
  dataScience: {
    coreSkillNames: ['Data science principles', 'Statistical analysis', 'Data cleaning', 'Data preparation', 'Machine Learning (ML)', 'Knowledge of prediction models'],
    additionalSkillNames: ['Programming', 'Data visualisation and storyboarding', 'Model lifecycles deployment management'],
    certificationIds: ['databricks-ml-associate'], experience: 'مشروعان يتضمنان خط أساس ومقارنة نماذج ومنع تسرب البيانات وتفسير النتائج.',
    projects: ['نموذج تنبؤ مع مقارنة وخط أساس', 'تحليل تجريبي وتفسير للنموذج'], evidenceKeywords: ['data science', 'prediction', 'model', 'علم بيانات'],
  },
  dataEngineering: {
    coreSkillNames: ['Data engineering', 'Data integration and interoperability', 'Data management', 'Database design', 'Data preparation', 'Programming'],
    additionalSkillNames: ['Data warehousing', 'Cloud computing', 'Continuous integration and continuous deployment'],
    certificationIds: ['microsoft-dp-700', 'google-professional-data-engineer'], experience: 'خط بيانات يعالج بيانات خام ويختبر الجودة ويخزن النتائج ويراقب الفشل.',
    projects: ['ETL/ELT مع اختبارات جودة', 'مستودع بيانات وخط تحميل مراقب'], evidenceKeywords: ['data engineer', 'pipeline', 'etl', 'warehouse', 'هندسة بيانات'],
  },
  dataviz: {
    coreSkillNames: ['Data visualisation and storyboarding', 'Data analytics', 'Data cleaning', 'Data preparation', 'Reporting and documentation', 'User requirements interpretation'],
    additionalSkillNames: ['Statistical analysis', 'Data collection and analysis', 'Prototyping tools and processes'],
    certificationIds: ['microsoft-pl-300'], experience: 'لوحات وتقارير تتبع مبادئ التصميم وتفسر البيانات وتختبر فهم المستخدم.',
    projects: ['قصة بيانات تفاعلية', 'إعادة تصميم لوحة مع اختبار قابلية الفهم'], evidenceKeywords: ['visualization', 'dashboard', 'power bi', 'تصور بيانات'],
  },
};

const titleTemplate: Record<string, string> = {
  'Software Developer': 'software', 'Software Engineer': 'software', 'Web Developer': 'web', 'Full-Stack Developer': 'web', 'Back-End Developer': 'backend', 'Mobile Application Developer': 'mobile', 'Front-End Developer': 'frontend', 'Mobile Developer': 'mobile', 'QA Engineer': 'qa', 'Software Test Engineer': 'qa',
  'Systems Analyst': 'systems', 'Business Analyst': 'business', 'Business Systems Analyst': 'business', 'ERP Specialist': 'erp', 'IT Project Coordinator': 'business', 'Database Specialist': 'database', 'Business Intelligence (BI) Analyst': 'bi', 'BI Analyst': 'bi',
  'IT Specialist': 'support', 'IT Support Specialist': 'support', 'Systems Administrator': 'sysadmin', 'Network Administrator': 'network', 'IT Operations Specialist': 'sysadmin', 'Cloud Support Specialist': 'cloud', 'IT Infrastructure Specialist': 'sysadmin', 'DevOps Engineer': 'devops', 'Systems Engineer': 'sysadmin', 'Network Engineer': 'network',
  'Computer Engineer': 'hardware', 'Hardware Engineer': 'hardware', 'Embedded Systems Engineer': 'embedded', 'IoT Engineer': 'iot', 'Firmware Engineer': 'embedded',
  'Cybersecurity Analyst': 'cyber', 'SOC Analyst': 'soc', 'Security Engineer': 'securityEngineering', 'Penetration Tester': 'pentest', 'Information Security Analyst': 'cyber', 'Incident Response Analyst': 'incident', 'Digital Forensics Analyst': 'forensics',
  'AI Engineer': 'ai', 'Machine Learning Engineer': 'ai', 'NLP Engineer': 'nlp', 'Computer Vision Engineer': 'vision', 'AI Developer': 'ai', 'Generative AI Engineer': 'nlp', 'AI Research Assistant': 'research',
  'Data Analyst': 'dataAnalyst', 'Data Scientist': 'dataScience', 'Data Engineer': 'dataEngineering', 'Data Visualization Specialist': 'dataviz', 'Junior Data Scientist': 'dataScience',
};

const defaultWeights = { skills: 50, practical: 25, certifications: 10, academic: 10, learning: 5 };
const weightByTemplate: Record<string, JobPathRequirementProfile['weights']> = {
  software: { skills: 55, practical: 25, certifications: 5, academic: 10, learning: 5 },
  web: { skills: 55, practical: 25, certifications: 5, academic: 10, learning: 5 },
  frontend: { skills: 55, practical: 25, certifications: 5, academic: 10, learning: 5 },
  backend: { skills: 50, practical: 25, certifications: 10, academic: 10, learning: 5 },
  mobile: { skills: 50, practical: 25, certifications: 10, academic: 10, learning: 5 },
  qa: { skills: 45, practical: 20, certifications: 20, academic: 10, learning: 5 },
  business: { skills: 45, practical: 25, certifications: 10, academic: 15, learning: 5 },
  systems: { skills: 45, practical: 25, certifications: 10, academic: 15, learning: 5 },
  erp: { skills: 40, practical: 20, certifications: 20, academic: 15, learning: 5 },
  database: { skills: 45, practical: 20, certifications: 20, academic: 10, learning: 5 },
  bi: { skills: 45, practical: 20, certifications: 15, academic: 15, learning: 5 },
  support: { skills: 40, practical: 20, certifications: 25, academic: 10, learning: 5 },
  sysadmin: { skills: 45, practical: 20, certifications: 25, academic: 5, learning: 5 },
  network: { skills: 45, practical: 20, certifications: 25, academic: 5, learning: 5 },
  cloud: { skills: 45, practical: 25, certifications: 15, academic: 10, learning: 5 },
  devops: { skills: 45, practical: 30, certifications: 15, academic: 5, learning: 5 },
  hardware: { skills: 45, practical: 35, certifications: 0, academic: 15, learning: 5 },
  embedded: { skills: 50, practical: 30, certifications: 0, academic: 15, learning: 5 },
  iot: { skills: 45, practical: 30, certifications: 10, academic: 10, learning: 5 },
  cyber: { skills: 45, practical: 20, certifications: 20, academic: 10, learning: 5 },
  soc: { skills: 40, practical: 20, certifications: 30, academic: 5, learning: 5 },
  securityEngineering: { skills: 45, practical: 25, certifications: 15, academic: 10, learning: 5 },
  pentest: { skills: 45, practical: 30, certifications: 15, academic: 5, learning: 5 },
  incident: { skills: 40, practical: 25, certifications: 25, academic: 5, learning: 5 },
  forensics: { skills: 45, practical: 25, certifications: 15, academic: 10, learning: 5 },
  ai: { skills: 45, practical: 25, certifications: 15, academic: 10, learning: 5 },
  nlp: { skills: 45, practical: 30, certifications: 10, academic: 10, learning: 5 },
  vision: { skills: 45, practical: 30, certifications: 10, academic: 10, learning: 5 },
  research: { skills: 40, practical: 35, certifications: 0, academic: 20, learning: 5 },
  dataAnalyst: { skills: 50, practical: 20, certifications: 15, academic: 10, learning: 5 },
  dataScience: { skills: 45, practical: 25, certifications: 10, academic: 15, learning: 5 },
  dataEngineering: { skills: 45, practical: 25, certifications: 15, academic: 10, learning: 5 },
  dataviz: { skills: 50, practical: 25, certifications: 10, academic: 10, learning: 5 },
};

function sourcesFor(templateName: string) {
  if (['cyber', 'soc', 'securityEngineering', 'pentest', 'incident', 'forensics'].includes(templateName)) return [scywf, sfia];
  if (['ai', 'nlp', 'vision', 'research', 'dataAnalyst', 'dataScience', 'dataEngineering', 'dataviz', 'bi'].includes(templateName)) return [sdaia, sfia];
  return [sfia];
}

export function jobPathRequirementProfile(id: string): JobPathRequirementProfile | null {
  const path = jobPathById(id);
  if (!path) return null;
  const templateName = titleTemplate[path.title];
  const template = templates[templateName];
  if (!template) return null;
  return {
    ...template,
    education: `درجة جامعية مناسبة مثل ${path.majors.join(' أو ')} مفيدة لهذا المسار، لكنها لا تعوض المهارات والمشروع العملي.`,
    sources: sourcesFor(templateName),
    weights: weightByTemplate[templateName] ?? defaultWeights,
  };
}

function rowFor(pathId: string, name: string, priority: 'core' | 'additional', index: number) {
  const skill = dataset.skills.find(item => item.name === name);
  if (!skill) throw new Error(`Unknown SSF skill in ${pathId}: ${name}`);
  return {
    career_id: pathId, skill_id: skill.skill_id, name: skill.name, priority,
    priority_rank: index + 1,
    weight: priority === 'core' ? (index < 2 ? 1.5 : index < 4 ? 1.25 : 1) : 0.5,
    evidence_url: jobPathRequirementProfile(pathId)?.sources[0]?.url ?? sfia.url,
  };
}

export function requirementsForCareerPath(id: string) {
  const profile = jobPathRequirementProfile(id);
  if (!profile) return dataset.career_skills.filter(item => item.career_id === id);
  return [
    ...profile.coreSkillNames.map((name, index) => rowFor(id, name, 'core', index)),
    ...profile.additionalSkillNames.map((name, index) => rowFor(id, name, 'additional', index)),
  ];
}

export function certificationIdsForCareerPath(id: string) {
  return jobPathRequirementProfile(id)?.certificationIds ?? [];
}
