export const parseUrl = (text: string) => {
  const result = text.match(/https?:\/\/[^\s]+/g)

  if (!result || result.length === 0) {
    return null
  }

  return result[0]
}

export const parseTextExcludeUrl = (text: string) => {
  const url = parseUrl(text)
  if (url === null) return text

  return text.replace(url, '').trim()
}
