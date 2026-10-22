import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { readSkillProfile, type SkillProfile } from '../utils/skill-profile';

export function useSkillProfile() {
  const [profile, setProfile] = useState<SkillProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    setReady(false);
    readSkillProfile().then(value => { if (active) { setProfile(value); setError(''); } }).catch(() => { if (active) setError('تعذر تحميل ملفك. افتح الصفحة مجددًا للمحاولة.'); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []));
  return { profile, ready, error, setProfile };
}
