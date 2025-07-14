/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your Worker in action
 * - Run `npm run deploy` to publish your Worker
 *
 * Bind resources to your Worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import type { RequestNotesCreate, ResponseNotesSearchByTag } from './types/MisskeyApi'
import type { OgpInfo } from './types/Ogp'
import { generateRandomNumbers } from './utils/random'
import { parseUrl } from './utils/textParser'

type MappedNote = {
  userName: string
  text: string
}

const KV_KEY = 'lastNoteId'

export default {
  async fetch(req) {
    return new Response('This is a Scheduled Worker. It does not respond to fetch requests.')
  },

  // The scheduled handler is invoked at the interval set in our wrangler.jsonc's
  // [[triggers]] configuration.
  async scheduled(_event, env, _ctx): Promise<void> {
    const sinceId = await env.note_id.get(KV_KEY) // 取得したノートのIDをどこかに保管
    console.log(`Last note ID: ${sinceId}`)

    // Misskeyからの対象のノート取得
    const fetchTargetNotes = async (sinceId: string | null): Promise<ResponseNotesSearchByTag> => {
      const res = await fetch(`https://${env.MISSKEY_HOST}/api/notes/search-by-tag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tag: 'listen_it',
          limit: 100,
          ...(sinceId ? { sinceId: sinceId } : {})
        })
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch notes: ${res.status} ${res.statusText}`)
      }

      return await res.json()
    }

    const fetchUrlMetadata = async (url: string): Promise<OgpInfo> => {
      const targetUrl = new URL(url)
      const ogpInfo = {} as OgpInfo
      let isHeadClosed = false

      if (![
        'soundcloud.com',
        'www.youtube.com',
        'music.youtube.com',
        'open.spotify.com',
        'music.apple.com',
        'bandcamp.com'
      ].includes(targetUrl.hostname)) {
        throw new Error(`Unsupported URL: ${targetUrl.hostname}`)
      }

      const res = await fetch(targetUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CloudflareWorkersOGPFetcher/1.0)'
        }
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch URL metadata: ${res.status} ${res.statusText}`)
      }

      const rewriter = new HTMLRewriter()
        .on('meta[property^="og:"]', {
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

      return ogpInfo
    }

    // Misskeyへの投稿
    const createNote = async (payload: MappedNote[]): Promise<void> => {
      const text = `#listen_it **今週のおすすめ楽曲はこちら！**\n${payload.map((note) => `・ ${note.text} (@${note.userName})`).join('\n')}`

      const res = await fetch(`https://${env.MISSKEY_HOST}/api/notes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.MISSKEY_API_TOKEN}`
        },
        body: JSON.stringify({
          visibility: 'public',
          localOnly: false,
          text: text
        } as RequestNotesCreate)
      })

      if (!res.ok) {
        throw new Error(`Failed to create note: ${res.status} ${res.statusText}`)
      }
    }

    try {
      const targetUsers: string[] = []

      const response = await fetchTargetNotes(sinceId)
      console.log(`Fetched ${response.length} notes.`)

      if (response.length === 0) {
        throw new Error('No target notes found.')
      }

      let notes = response.filter((item) => {
        if (parseUrl(item.text) === null) return false // URLが含まれていないノートは除外
        if (item.userId === env.MISSKEY_BOT_USER_ID) return false // Bot自身のノートは除外
        return true
      })

      if (notes.length === 0) {
        throw new Error('No notes (with URL) found.')
      }

      if (notes.length > 5) {
        notes = notes.filter((item) => {
          if (targetUsers.includes(item.userId)) return false // 既に収集済みのユーザーは除外
          targetUsers.push(item.userId)
          return true
        })
      }

      if (notes.length > 5) {
        const targetIndex = generateRandomNumbers(notes.length)

        notes = notes.filter((_item, index) => {
          return targetIndex.includes(index) // 5件以上のノートがある場合、ランダムに選択されたインデックス以外は除外
        })
      }

      const mappedNotes: MappedNote[] = await Promise.all(notes.map(async (item) => {
        const url = parseUrl(item.text)
        let ogpText = ''

        if (!url) {
          throw new Error(`No valid URL found in note: ${item.id}`)
        }

        try {
          const ogpInfo = await fetchUrlMetadata(url)
          console.log(`Fetched OGP for URL ${url}:`, ogpInfo)
          ogpText = `${ogpInfo['og:title']}` // OGP情報をノートのテキストに追加
        } catch (error) {
          console.error(`Failed to fetch OGP for URL ${url}:`, error)
        }

        return {
          userName: item.user.username,
          text: ogpText
        }
      }))

      console.log(`Mapped notes: ${JSON.stringify(mappedNotes)}`)

      await createNote(mappedNotes)
      await env.note_id.put('lastNoteId', response[0].id) // 取得したノートのIDを保存

      console.log(`Created note with ${mappedNotes.length} items.`)
    } catch (error) {
      console.error('Error:', error)
      return
    }
  }
} satisfies ExportedHandler<Env>
