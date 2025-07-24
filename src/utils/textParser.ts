export const parseUrl = (text: string) => {
  const result = text.match(/https?:\/\/[^\s]+/g)

  if (!result || result.length === 0) {
    return null
  }

  return result[0]
}


export const parseTextOnly = (text: string): string => {
  // テキストからURLを除去
  return text.replace(/https?:\/\/[^\s]+|#listen_it/g, '').trim()
}
