import { MAX_NOTES } from '../constants'

export const generateRandomNumbers = (max: number, size: number = MAX_NOTES): number[] => {
  if (max <= 0 || size <= 0) {
    return []
  }

  const length = Math.min(size, max)
  const indices = Array.from({ length: max }, (_item, index) => index)

  return randomSort(indices).slice(0, length)
}

export const randomSort = <T>(array: T[]): T[] => {
  const cloned = [...array]

  for (let i = cloned.length - 1; i > 0; i--) {
    const rand = Math.floor(Math.random() * (i + 1))
    ;[cloned[i], cloned[rand]] = [cloned[rand], cloned[i]]
  }

  return cloned
}
