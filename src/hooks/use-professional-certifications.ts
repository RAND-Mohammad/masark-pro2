import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { changeProfessionalCertification, readProfessionalCertifications } from '../utils/professional-certifications';

export function useProfessionalCertifications() {
  const [achieved, setAchieved] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const reload = useCallback(async () => {
    setReady(false);
    try { setAchieved(await readProfessionalCertifications()); setError(''); setReady(true); }
    catch { setError('تعذر تحميل شهاداتك المهنية. حاول مجددًا.'); }
  }, []);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  async function change(id: string, value: boolean) {
    if (!ready || locked.current) return;
    locked.current = true; setBusy(true);
    try { setAchieved(await changeProfessionalCertification(id, value)); setError(''); }
    catch { setError('تعذر حفظ الشهادة المهنية. حاول مجددًا.'); }
    finally { locked.current = false; setBusy(false); }
  }
  return { achieved, ready, busy, error, reload, change };
}
