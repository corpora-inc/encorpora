# Lingo Hero

A rhythm-based language learning game for Corpan.

## How to Run (Recommended Method)

This method uses the main Corpan App's dev server to host the pack, which avoids network/IP issues.

1.  **Start the Build Watcher:**
    ```bash
    cd packs/lingo-hero
    npm run dev:integrated
    ```
    *This keeps your code built in the `dist/` folder.*

2.  **Configure Corpan App:**
    -   Ensure `npm run tauri dev` is running in `corpan-app`.
    -   Go to **Settings** -> **Corpan** (tap 7 times).
    -   Set Manifest URL to:
        ```
        /packs/lingo-hero/manifest.json
        ```
    -   *Note: Use the exact relative path shown above.*

## Legacy Method (Python Server)

If the integrated method fails or you are testing a release build:

1.  Run `npm run dev:corpan`.
2.  Set Manifest URL to `http://<YOUR_IP>:8990/lingo-hero/manifest.json`.

## Development

-   `npm run dev`: Run in standalone browser mode.
-   `npm run build`: Build for production.
