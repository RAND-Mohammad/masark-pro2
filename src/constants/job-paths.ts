import { academicPrograms, type JobTitleOption } from './academic-programs';

export type JobPath = JobTitleOption & {
  id: string;
  baseCareerId: string;
  majors: string[];
  description: string;
};

const baseCareerIdByTitle: Record<string, string> = {
  'Software Developer': 'C01', 'Software Engineer': 'C01', 'Web Developer': 'C01', 'Full-Stack Developer': 'C01', 'Back-End Developer': 'C01', 'Mobile Application Developer': 'C01', 'Front-End Developer': 'C01', 'Mobile Developer': 'C01', 'QA Engineer': 'C01', 'Software Test Engineer': 'C01',
  'Systems Analyst': 'C09', 'Business Analyst': 'C09', 'Business Systems Analyst': 'C09', 'ERP Specialist': 'C09', 'IT Project Coordinator': 'C09',
  'IT Specialist': 'C08', 'IT Support Specialist': 'C08', 'Systems Administrator': 'C08', 'IT Operations Specialist': 'C08', 'Cloud Support Specialist': 'C08', 'IT Infrastructure Specialist': 'C08', 'DevOps Engineer': 'C08', 'Systems Engineer': 'C08',
  'Network Administrator': 'C06', 'Network Engineer': 'C06',
  'Database Specialist': 'C07', 'Data Engineer': 'C07',
  'Business Intelligence (BI) Analyst': 'C02', 'BI Analyst': 'C02', 'Data Analyst': 'C02', 'Data Visualization Specialist': 'C02',
  'Computer Engineer': 'C01', 'Hardware Engineer': 'C01', 'Embedded Systems Engineer': 'C01', 'IoT Engineer': 'C01', 'Firmware Engineer': 'C01',
  'Cybersecurity Analyst': 'C05', 'SOC Analyst': 'C05', 'Security Engineer': 'C05', 'Penetration Tester': 'C05', 'Information Security Analyst': 'C05', 'Incident Response Analyst': 'C05', 'Digital Forensics Analyst': 'C05',
  'AI Engineer': 'C04', 'Machine Learning Engineer': 'C04', 'NLP Engineer': 'C04', 'Computer Vision Engineer': 'C04', 'AI Developer': 'C04', 'Generative AI Engineer': 'C04', 'AI Research Assistant': 'C04',
  'Data Scientist': 'C03', 'Junior Data Scientist': 'C03',
};

const slug = (title: string) => title.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const paths = new Map<string, JobPath>();
for (const program of academicPrograms) {
  for (const job of program.commonTitles) {
    const current = paths.get(job.title);
    if (current) {
      if (!current.majors.includes(program.title)) current.majors.push(program.title);
      if (job.stage === 'entry') current.stage = 'entry';
      continue;
    }
    const baseCareerId = baseCareerIdByTitle[job.title];
    if (!baseCareerId) throw new Error(`Missing career mapping for ${job.title}`);
    paths.set(job.title, { ...job, id: `job-${slug(job.title)}`, baseCareerId, majors: [program.title], description: `مسار ${job.title} والمهارات والأدلة المطلوبة للاستعداد له.` });
  }
}

export const jobPaths = [...paths.values()];
export const jobPathIds = new Set(jobPaths.map(path => path.id));
export function jobPathById(id: string | undefined | null) { return jobPaths.find(path => path.id === id) ?? null; }
export function resolveBaseCareerId(id: string) { return jobPathById(id)?.baseCareerId ?? id; }
export function jobPathForTitle(title: string) { return jobPaths.find(path => path.title === title) ?? null; }
