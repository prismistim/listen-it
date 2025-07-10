export const generateRandomNumbers = (max: number): number[] => {
  const numbers: Set<number> = new Set()
  while (numbers.size < 5) {
    const randomNumber = Math.floor(Math.random() * max)
    numbers.add(randomNumber)
  }
  return Array.from(numbers)
}
