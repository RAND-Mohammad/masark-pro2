const skillLabels: Record<string, string> = {
  Programming: 'البرمجة',
  'Software design': 'تصميم وتنظيم الكود',
  'Software testing': 'كتابة اختبارات آلية للكود',
  'Software development and integration': 'تطوير وربط مكونات التطبيق',
  'Software requirements analysis': 'تحليل متطلبات التطبيق',
  'Reporting and documentation': 'توثيق المشروع وشرح العمل',
};

export function displaySkillName(name: string) {
  return skillLabels[name] ?? name;
}
