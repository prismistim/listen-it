import { TARGET_HOSTS } from '../constants'
import type { OgpInfo } from '../types/Ogp'

export const fetchUrlMetadata = async (url: string): Promise<OgpInfo | null> => {
  const targetUrl = new URL(url)
  const ogpInfo = {} as OgpInfo

  if (!checkTargetHost(url)) {
    console.warn(`Unsupported URL: ${targetUrl.hostname}`)
    return null
  }

  const res = await fetch(targetUrl.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CloudflareWorkersOGPFetcher/1.0)'
    }
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch URL metadata: ${res.status} ${res.statusText}`)
  }

  const rewriter = new HTMLRewriter().on('meta[property^="og:"]', {
    element(element) {
      const property = element.getAttribute('property') as keyof OgpInfo
      const content = element.getAttribute('content')

      if (property && content) {
        ogpInfo[property] = content
      }
    }
  })

  const rewriterRes = rewriter.transform(res)
  await rewriterRes.arrayBuffer()

  if (Object.keys(ogpInfo).length === 0) {
    throw new Error('No OGP metadata found in the URL')
  }

  return ogpInfo
}

export const checkTargetHost = (url: string): boolean => {
  if (url === '') return false
  const targetUrl = new URL(url)
  return TARGET_HOSTS.some((host) => targetUrl.hostname.includes(host))
}

const escapeMarkdown = (text: string) => text.replace(/([[\]()])/g, '\\$1')
