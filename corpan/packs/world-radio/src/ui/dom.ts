type Attrs = Record<string, string | number | boolean | undefined | null>

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue
    if (k === "class") node.className = String(v)
    else if (k === "html") node.innerHTML = String(v)
    else if (k.startsWith("on") && typeof v === "function") {
      // Defensive — caller should use addEventListener; left here for completeness.
      node.addEventListener(k.slice(2).toLowerCase(), v as unknown as EventListener)
    } else {
      node.setAttribute(k, String(v))
    }
  }
  for (const c of children) {
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c)
  }
  return node
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild)
}
