# Corpan Game SDK (prototype)

This lightweight SDK registers a game with the Corpan host and provides a mock host API for browser development.

## Usage (game bundle)

```js
import { registerGame } from "./sdk/index.js";

registerGame({
  id: "my-game",
  mount(container, hostApi) {
    // render into container
  },
});
```

## Standalone development

```js
import { registerGame, mountStandalone } from "./sdk/index.js";

const game = registerGame({
  id: "my-game",
  mount(container, hostApi) {
    // render into container
  },
});

mountStandalone(game);
```

## Manifest shape

```json
{
  "id": "my-game",
  "name": "My Game",
  "version": "0.1.0",
  "entry": "app.js",
  "styles": ["app.css"],
  "entryType": "script",
  "databases": {
    "main": "data/game.sqlite3"
  }
}
```

## Host API (selected)

- `queryPackDb({ sql, params, dbName })` runs a read-only query against the pack's SQLite database.
- `searchEntriesByText({ text, languageCodes, limit, offset })` returns core corpus entries whose translations contain `text`.
