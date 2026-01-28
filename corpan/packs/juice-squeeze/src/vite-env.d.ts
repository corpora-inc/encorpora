/// <reference types="vite/client" />

// Declare module types for asset imports
declare module "*.glb" {
  const src: string
  export default src
}

declare module "*.mp3" {
  const src: string
  export default src
}

declare module "*.wav" {
  const src: string
  export default src
}
