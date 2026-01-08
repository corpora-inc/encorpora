# Corpan Pack SDK (prototype)

This lightweight SDK registers a pack with the Corpan host and provides a mock host API for browser development.

## Usage (pack bundle)

```js
import { registerGame } from "./sdk/index.js";

registerGame({
  id: "my-pack",
  mount(container, hostApi) {
    // render into container
  },
});
```

## Standalone development

```js
import { registerGame, mountStandalone } from "./sdk/index.js";

const pack = registerGame({
  id: "my-pack",
  mount(container, hostApi) {
    // render into container
  },
});

mountStandalone(pack);
```

## Manifest shape

```json
{
  "id": "my-pack",
  "name": "My Pack",
  "version": "0.1.0",
  "entry": "app.js",
  "styles": ["app.css"],
  "entryType": "script",
  "databases": {
    "main": "data/pack.sqlite3"
  }
}
```

## Host API (selected)

- `queryPackDb({ sql, params, dbName })` runs a read-only query against the pack's SQLite database.
- `searchEntriesByText({ text, languageCodes, limit, offset })` returns core corpus entries whose translations contain `text`.
