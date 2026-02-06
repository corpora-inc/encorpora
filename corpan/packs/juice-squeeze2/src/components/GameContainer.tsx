import { type ReactNode } from "react"

type GameContainerProps = {
  children: ReactNode
  fruitPrimary: string
  fruitLight: string
  fruitDark: string
}

export function GameContainer({ children, fruitPrimary, fruitLight, fruitDark }: GameContainerProps) {
  return (
    <div
      className="game-container"
      style={{
        "--fruit-primary": fruitPrimary,
        "--fruit-light": fruitLight,
        "--fruit-dark": fruitDark,
      } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
