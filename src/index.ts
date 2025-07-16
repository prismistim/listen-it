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


import type { ResponseNotesSearchByTag } from './types/MisskeyApi'
import type { NoteInfo } from './types/NoteInfo'

import { checkTargetHost } from './utils/fetchUrlMetadata'
import { parseUrl, parseTextExcludeUrl } from './utils/textParser'

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

    // 必要な情報を抽出
    const mapNoteInfo = async (notes: ResponseNotesSearchByTag): Promise<NoteInfo[]> => {
      return notes.filter((item) => {
        const url = parseUrl(item.text)
        if (url === null) return false
        if (!checkTargetHost(url)) return false
        return true
      }).map(((item) => {
        return {
          userId: item.user.id,
          noteId: item.id,
          url: parseUrl(item.text) as string,
          text: parseTextExcludeUrl(item.text),
        }
      }))
    }

    try {
      const response = await fetchTargetNotes(sinceId)
      console.log(`Fetched ${response.length} notes.`)

      if (response.length === 0) {
        throw new Error('No target notes found.')
      }

      const notes = response.filter((item) => {
        if (parseUrl(item.text) === null) return false // URLが含まれていないノートは除外
        if (item.userId === env.MISSKEY_BOT_USER_ID) return false // Bot自身のノートは除外
        return true
      })

      if (notes.length === 0) {
        throw new Error('No notes (with URL) found.')
      }

      const mappedNotes = await mapNoteInfo(notes)

      mappedNotes.forEach(async (item) => {
        // D1に保存
        const { success } = await env.DB.prepare(
          'INSERT INTO notes (user_id, note_id, note_text, content_url) VALUES (?, ?, ?, ?)'
        ).bind(item.userId, item.noteId, item.text, item.url).run()

        if (!success) {
          throw new Error('Database Error')
        }

        console.log(`DB insert success: ${item.noteId}`)
      })

      await env.note_id.put('lastNoteId', response[0].id) // 取得したノートのIDを保存

      console.log(`Stored note with ${mappedNotes.length} items. Last noteId is ${response[0].id}`)
    } catch (error) {
      console.error('Error:', error)
      return
    }
  }
} satisfies ExportedHandler<Env>
