import { MAX_NOTES } from '../constants'

export const generateRandomNumbers = (max: number): number[] => {
  const numbers: Set<number> = new Set()
  while (numbers.size < MAX_NOTES) {
    const randomNumber = Math.floor(Math.random() * max)
    numbers.add(randomNumber)
  }
  return Array.from(numbers)
}

export const randomSort = <T>(array: T[]): T[] => {
  const cloned = [...array]

  for (let i = cloned.length - 1; i > 0; i--) {
    const rand = Math.floor(Math.random() * (i + 1))
    ;[cloned[i], cloned[rand]] = [cloned[rand], cloned[i]]
  }

  return cloned
}
