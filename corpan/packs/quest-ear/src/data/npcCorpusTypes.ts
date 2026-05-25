/** Map of language code → translated text */
export type MultiLangText = Record<string, string>

export type ResponseType = "accept" | "decline" | "arbitrary"

export interface NPCResponse {
  type: ResponseType
  text: MultiLangText
}

export interface NPCEncounter {
  id: string
  npcType: string
  offering: MultiLangText
  responses: [NPCResponse, NPCResponse, NPCResponse]
}

export type NPCCorpus = NPCEncounter[]
