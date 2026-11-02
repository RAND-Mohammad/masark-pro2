import { fetch } from 'expo/fetch';
import { replaceLearningResources } from '../constants/learning-resources';
import { serverUrl } from './cv-api';

export async function refreshLearningResources() {
  try {
    const response = await fetch(`${serverUrl()}/learning-resources`, { method: 'GET', signal: AbortSignal.timeout(8000) });
    if (!response.ok) return false;
    return replaceLearningResources(await response.json());
  } catch { return false; }
}
