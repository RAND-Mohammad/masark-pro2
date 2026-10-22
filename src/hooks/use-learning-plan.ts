import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { changeLearningPlan, readLearningPlan, addLearningPlanItems } from '../utils/learning-plan';

export function useLearningPlan() {
  const [plan, setPlan] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const revision = useRef(0);

  const reload = useCallback(async () => {
    const request = ++revision.current;
    setReady(false);
    try {
      const saved = await readLearningPlan();
      if (request === revision.current) {
        setPlan(saved);
        setError('');
        setReady(true);
      }
    } catch {
      if (request === revision.current) setError('تعذر تحميل خطة التعلم. حاول مجددًا.');
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void reload();
    return () => { revision.current += 1; };
  }, [reload]));

  async function change(id: string, add: boolean) {
    if (!ready || locked.current) return;
    locked.current = true;
    setBusy(true);
    revision.current += 1;
    try {
      const saved = await changeLearningPlan(id, add);
      setPlan(saved);
      setError('');
    } catch {
      setError('تعذر حفظ التغيير. حاول مجددًا؛ خطتك السابقة محفوظة.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function addItems(ids: string[]) {
    if (!ready || locked.current) return false;
    locked.current = true; setBusy(true); revision.current += 1;
    try { setPlan(await addLearningPlanItems(ids)); setError(''); return true; }
    catch { setError('تعذر حفظ خطة الفجوات. خطتك السابقة محفوظة.'); return false; }
    finally { locked.current = false; setBusy(false); }
  }
  return { plan, ready, error, busy, reload, change, addItems };
}
