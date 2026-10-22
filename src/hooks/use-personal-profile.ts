import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { readPersonalProfile, type PersonalProfile } from '../utils/personal-profile';

export function usePersonalProfile() {
  const [personal, setPersonal] = useState<PersonalProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true; setReady(false);
    void readPersonalProfile().then(value => { if (active) { setPersonal(value); setError(''); } }).catch(() => { if (active) setError('تعذر تحميل بيانات ملفك. أعد فتح الصفحة.'); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []));
  return { personal, ready, error, setPersonal };
}
