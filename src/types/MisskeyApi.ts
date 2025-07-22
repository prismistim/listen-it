export type ResponseNotesSearchByTag = {
  id: string
  createdAt: string
  userId: string
  user: User
  text: string
  cw: null
  visibility: string
  localOnly: boolean
  reactionAcceptance: string
  renoteCount: number
  repliesCount: number
  reactionCount: number
  reactions: Emojis
  reactionEmojis: Emojis
  tags: string[]
  fileIds: any[]
  files: any[]
  replyId: null
  renoteId: null
  clippedCount: number
}[]

export type User = {
  id: string
  name: string
  username: string
  host: null
  avatarUrl: string
  avatarBlurhash: string
  avatarDecorations: any[]
  isBot: boolean
  isCat: boolean
  emojis: Emojis
  onlineStatus: string
  badgeRoles: any[]
}

type Emojis = {}

export type RequestNotesCreate = {
  visibility: string
  visibleUserIds: string[]
  localOnly: boolean
  reactionAcceptance: null
  noExtractMentions: boolean
  noExtractHashtags: boolean
  noExtractEmojis: boolean
  replyId: null
  renoteId: null
  channelId: null
  text: string
}

export type PageContentText = {
  id: string
  type: 'text'
  text: string
}

export type PageContentNote = {
  id: string
  type: 'note'
  detailed: boolean
  note: string | null
}

export type PageContentImage = {
  id: string
  type: 'image'
  fileId: string
}

export type PageContentSection = {
  id: string
  type: 'section'
  title: string
  children: (PageContentText | PageContentNote | PageContentImage | PageContentSection)[]
}

export type RequestPagesCreate = {
  title: string
  name: string
  summary?: string
  content: (PageContentText | PageContentNote | PageContentImage | PageContentSection)[]
  variables: Record<string, string>[]
  script: string
  eyeCatchImageId?: string
  font?: 'serif' | 'sans-serif' | 'string'
  alignCenter?: boolean
  hideTitleWhenPinned?: boolean
}
