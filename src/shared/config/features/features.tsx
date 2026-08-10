import type { PropsWithChildren } from 'react'
import { useFeatureFlag, type FeatureName } from './useFeatureFlag'

type Props = PropsWithChildren<{
  featureName: FeatureName
}>

export const FeatureGate = ({ featureName, children }: Props) => {
  return useFeatureFlag(featureName) ? <>{children}</> : null
}
