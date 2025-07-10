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
      const targetUsers: string[] = []

      const response = await fetchTargetNotes(sinceId)
      console.log(`Fetched ${response.length} notes.`)

      if (response.length === 0) {
        throw new Error('No notes found.')
      }

      let notes = response.filter((item) => {
        if (parseUrl(item.text) === null) return false // URLが含まれていないノートは除外
        if (item.userId === env.MISSKEY_BOT_USER_ID) return false // Bot自身のノートは除外
        return true
      })

      if (notes.length === 0) {
        throw new Error('No notes found.')
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

      const mappedNotes: MappedNote[] = notes.map((item) => {
        return {
          userName: item.user.username,
          url: parseUrl(item.text) || ''
        }
      })

      await createNote(mappedNotes)
      await env.note_id.put('lastNoteId', response[0].id) // 取得したノートのIDを保存

      console.log(`Created note with ${mappedNotes.length} items.`)
    } catch (error) {
      console.error('Error:', error)
      return
    }
  }
} satisfies ExportedHandler<Env>
