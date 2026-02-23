export type CloseButton = {
  dispose: () => void
}

/**
 * Create a faint close (X) button in the top-right corner.
 * Calls onBeforeClose for state saving, then dispatches corpan:exit.
 */
export function createCloseButton(
  parent: HTMLElement,
  onBeforeClose?: () => void
): CloseButton {
  const btn = document.createElement("button")
  btn.className = "stargate-close-btn"
  btn.title = "Close"
  // Inline SVG X icon matching Lucide's X (20×20, stroke-width 2)
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  btn.addEventListener("click", () => {
    onBeforeClose?.()
    window.dispatchEvent(new Event("corpan:exit"))
  })
  parent.appendChild(btn)

  return {
    dispose() {
      btn.remove()
    },
  }
}
