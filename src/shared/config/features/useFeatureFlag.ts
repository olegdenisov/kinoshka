export type FeatureName = 'recommendations' | 'popularThisWeek' | 'toggleTheme'

const FEATURE: Record<FeatureName, boolean> = {
  popularThisWeek: false,
  recommendations: false,
  toggleTheme: false,
}

export const useFeatureFlag = (featureName: FeatureName): boolean =>
  FEATURE[featureName]
