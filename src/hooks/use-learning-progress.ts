import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { changeLearningResource, readLearningProgress, type LearningProgress } from '../utils/learning-progress';

export function useLearningProgress() {
  const [progress, setProgress] = useState<LearningProgress>({});
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);

  const reload = useCallback(async () => {
    setReady(false);
    try { setProgress(await readLearningProgress()); setError(''); setReady(true); }
    catch { setError('تعذر تحميل تقدم الدورات. حاول مجددًا.'); }
  }, []);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  async function change(id: string, completed: boolean) {
    if (!ready || locked.current) return;
    locked.current = true; setBusy(true);
    try { setProgress(await changeLearningResource(id, completed)); setError(''); }
    catch { setError('تعذر حفظ تقدم الدورة. حاول مجددًا.'); }
    finally { locked.current = false; setBusy(false); }
  }

  return { progress, ready, busy, error, reload, change };
}
