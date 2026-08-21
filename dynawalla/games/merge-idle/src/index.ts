import { __installMount, mount } from './contract.ts'
import { mountGame } from './game.ts'

__installMount(mountGame)

export { mount }
export type { Host, Question } from './contract.ts'
export { makeStubHost } from './stubHost.ts'
