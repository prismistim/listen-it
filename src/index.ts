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

import dayjs from 'dayjs'
import 'dayjs/locale/ja'
import { KV_KEY, MAX_FETCH_LIMIT, MAX_NOTES } from './constants'
import type {
  PageContentImage,
  PageContentNote,
  PageContentSection,
  PageContentText,
  RequestNotesCreate,
  RequestPagesCreate,
  ResponseNotesSearchByTag
} from './types/MisskeyApi'
import { checkTargetHost, fetchUrlMetadata } from './utils/fetchUrlMetadata'
import { generateRandomNumbers, randomSort } from './utils/random'
import { parseTextOnly, parseUrl } from './utils/textParser'

type MappedNote = Readonly<{
  userName: string
  text: string
}>

dayjs.locale('ja')

export default {
  async fetch(req) {
    return new Response('This is a Scheduled Worker. It does not respond to fetch requests.')
  },

  // The scheduled handler is invoked at the interval set in our wrangler.jsonc's
  // [[triggers]] configuration.
  async scheduled(_event, env, _ctx): Promise<void> {
    const sinceId = await env.note_id.get(KV_KEY)
    const today = dayjs().format('YYYYMMDD')
    console.log(`Start scheduled task. Date: ${today}`)
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
          limit: MAX_FETCH_LIMIT,
          ...(sinceId ? { sinceId: sinceId } : {})
        })
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch notes: ${res.status} ${res.statusText}`)
      }

      return await res.json()
    }

    const mapOgpInfo = async (notes: ResponseNotesSearchByTag): Promise<MappedNote[]> => {
      const targetNotes = notes.map((item) => {
        return {
          userName: item.user.username,
          url: parseUrl(item.text) as string,
          text: parseTextOnly(item.text)
        }
      })

      if (targetNotes.length === 0) {
        throw new Error('No notes with URLs found.')
      }

      return Promise.all(
        targetNotes.map(async (item) => {
          const ogpInfo = await fetchUrlMetadata(item.url)

          if (ogpInfo === null) {
            console.warn(`No OGP metadata found for URL: ${item.url}`)
            return {
              userName: item.userName,
              text: `\`${item.url}\``
            }
          }

          return {
            userName: item.userName,
            text: `\n\`${ogpInfo['og:title']}\`\n<small>\`${ogpInfo['og:description'].length > 40 ? `${ogpInfo['og:description'].slice(0, 40)}...` : ogpInfo['og:description']}\`</small>\n${item.text !== '' ? `> ${item.text}\n` : ''} by @${item.userName}\n${item.url}\n`
          }
        })
      )
    }

    // Misskeyへの投稿
    const createPage = async (payload: MappedNote[]): Promise<string> => {
      const randomId = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 4)
      const pageName = `listen_it_${today}_${randomId}${env.ENVIRONMENT === 'development' ? '_dev' : ''}`

      const res = await fetch(`https://${env.MISSKEY_HOST}/api/pages/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.MISSKEY_API_TOKEN}`
        },
        body: JSON.stringify({
          title: `#listen_it ${today}`,
          name: pageName,
          script: '今日までに登録されたおすすめ楽曲をまとめました！',
          variables: [{}],
          content: [
            {
              id: 'content-0',
              type: 'text',
              text: `このページは、${dayjs().format('YYYY年MM月DD日')}までに #listen_it をつけて投稿されたおすすめ楽曲をまとめたものです。以下の楽曲をぜひチェックしてみてください！`
            },
            {
              id: 'content-1',
              type: 'section',
              title: '今週のおすすめ楽曲',
              children: payload.map((note, index) => ({
                id: `content-${index + 2}`,
                type: 'text',
                text: note.text
              }))
            }
          ] as (PageContentText | PageContentNote | PageContentImage | PageContentSection)[]
        } as RequestPagesCreate)
      })

      const resJson = await res.json()

      if (!res.ok) {
        console.error('Error creating page:', resJson)
        throw new Error(`Failed to create note: ${res.status}`)
      }

      console.log('Page created successfully:', resJson)
      return pageName
    }

    // Misskeyへの投稿
    const createNote = async (noteName: string): Promise<void> => {
      const text = `#listen_it 今週のおすすめ楽曲はこちら！\nhttps://${env.MISSKEY_HOST}/@${env.MISSKEY_BOT_USERNAME}/pages/${noteName}`

      const res = await fetch(`https://${env.MISSKEY_HOST}/api/notes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.MISSKEY_API_TOKEN}`
        },
        body: JSON.stringify({
          visibility: 'home',
          localOnly: false,
          text: text
        } as RequestNotesCreate)
      })

      const resJson = await res.json()

      if (!res.ok) {
        throw new Error(`Failed to create note: ${res.status} ${res.statusText}\n${resJson}`)
      }
    }

    try {
      const response = await fetchTargetNotes(sinceId)
      console.log(`Fetched ${response.length} notes.`)

      if (response.length === 0) {
        throw new Error('No target notes found.')
      }

      // URLを含むノートのみ抽出
      let notes = response.filter(
        (item) =>
          (parseUrl(item.text) !== null || checkTargetHost(parseUrl(item.text) ?? '')) &&
          item.userId !== env.MISSKEY_BOT_USER_ID
      )

      if (notes.length === 0) {
        throw new Error('No notes (with URL) found.')
      }

      notes = randomSort(notes)

      console.log(`Filtered notes with URLs: ${notes.length}`)

      const pickedUserNotes = Array.from(new Map(notes.map((note) => [note.userId, note])).values())

      console.log(`Picked ${pickedUserNotes.length} unique user notes.`)

      if (pickedUserNotes.length >= MAX_NOTES) {
        const targetIndex = generateRandomNumbers(notes.length).slice(0, MAX_NOTES)
        notes = notes.filter((_item, index) => targetIndex.includes(index))
      } else {
        // ユーザーごとにランダムに選択し、MAX_NOTESに満たない場合は他のユーザーからランダムに選択
        const remaining = MAX_NOTES - pickedUserNotes.length
        const remainingNotes = notes.filter((item) => !pickedUserNotes.some((picked) => picked.id === item.id))

        console.log(`Remaining notes to pick: ${remaining}, Unused notes: ${remainingNotes.length}`)

        if (remainingNotes.length === 0) {
          notes = pickedUserNotes
        } else {
          const targetIndex = generateRandomNumbers(remainingNotes.length).slice(0, remaining)
          notes = [...pickedUserNotes, ...remainingNotes.filter((_item, index) => targetIndex.includes(index))]
        }
      }

      const mappedNotes = await mapOgpInfo(notes)

      const noteName = await createPage(mappedNotes)
      await createNote(noteName)
      await env.note_id.put('lastNoteId', response[0].id) // 取得したノートのIDを保存

      console.log(`Created page with ${mappedNotes.length} items.`)
    } catch (error) {
      console.error('Error:', error)
      return
    }
  }
} satisfies ExportedHandler<Env>
