import { useSyncExternalStore } from 'react';
import { learningResourcesVersion, subscribeLearningResources } from '../constants/learning-resources';

export function useLearningResources() {
  return useSyncExternalStore(subscribeLearningResources, learningResourcesVersion, learningResourcesVersion);
}
