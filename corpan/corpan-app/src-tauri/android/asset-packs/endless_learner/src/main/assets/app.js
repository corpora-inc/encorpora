(function () {
  const registry = (window.CorpanGames = window.CorpanGames || {})

  registry["endless_learner"] = {
    mount: (container) => {
      const root = document.createElement("div")
      root.className = "game-shell"
      root.innerHTML =
        "<div class=\"hud\"><div class=\"hud-center\"><div class=\"prompt\">Build required</div><div class=\"choices\"><span class=\"choice\">Run npm run build in games/endless-learner</span></div></div></div>"
      container.appendChild(root)
      return {
        unmount: () => {
          container.removeChild(root)
        },
      }
    },
  }
})()
