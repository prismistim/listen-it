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
import { generateRandomNumbers } from './utils/random'
import { parseUrl } from './utils/textParser'

type MappedNote = {
  userName: string
  url: string
}

export default {
  async fetch(req) {
    return new Response('This is a Scheduled Worker. It does not respond to fetch requests.')
  },

  // The scheduled handler is invoked at the interval set in our wrangler.jsonc's
  // [[triggers]] configuration.
  async scheduled(event, env, ctx): Promise<void> {
    const sinceId = '' // 取得したノートのIDをどこかに保管

    // Misskeyからの対象のノート取得
    const fetchTargetNotes = async (sinceId: string): Promise<ResponseNotesSearchByTag> => {
      const res = await fetch(`https://${env.MISSKEY_HOST}/api/notes/search-by-tag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tag: 'listen_it',
          limit: 100
        })
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch notes: ${res.status} ${res.statusText}`)
      }

      return await res.json()
    }

    // Misskeyへの投稿
    const createNote = async (payload: MappedNote[]): Promise<void> => {
      const text = `#listen_it **今週のおすすめ楽曲はこちら！**\n${payload.map((note) => `・ ${note.url} (@${note.userName})`).join('\n')}`

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
      const notes = (await fetchTargetNotes(sinceId)).filter((item, index) => {
          if (parseUrl(item.text) === null) return false // URLが含まれていないノートは除外
          if (item.userId === env.MISSKEY_BOT_USER_ID) return false // Bot自身のノートは除外
          return true
      })

      if (notes.length === 0) {
        throw new Error('No notes found.')
      }

      const targetIndex = generateRandomNumbers(notes.length)

      const mappedNotes: MappedNote[] = notes.filter((_item, index) => {
        return targetIndex.includes(index) // 5件以上のノートがある場合、ランダムに選択されたインデックス以外は除外
      }).map((item) => {
        return {
          userName: item.user.username,
          url: parseUrl(item.text) || ''
        }
      })

      createNote(mappedNotes)
    } catch (error) {
      console.error('Error:', error)
      return
    }
  }
} satisfies ExportedHandler<Env>
