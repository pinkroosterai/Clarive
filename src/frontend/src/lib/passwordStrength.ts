import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core'
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common'
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en'

zxcvbnOptions.setOptions({
  translations: zxcvbnEnPackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
})

export type StrengthScore = 0 | 1 | 2 | 3 | 4

export interface PasswordStrength {
  score: StrengthScore
  label: string
  feedback: string[]
  crackTime: string
}

const LABELS: Record<StrengthScore, string> = {
  0: 'Very weak',
  1: 'Weak',
  2: 'Fair',
  3: 'Strong',
  4: 'Very strong',
}

export function evaluatePassword(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: LABELS[0], feedback: [], crackTime: '' }
  }

  const result = zxcvbn(password)
  const score = result.score as StrengthScore
  const feedback = [
    result.feedback.warning,
    ...result.feedback.suggestions,
  ].filter(Boolean) as string[]

  return {
    score,
    label: LABELS[score],
    feedback,
    crackTime: result.crackTimesDisplay.offlineSlowHashing1e4PerSecond,
  }
}
