#!/usr/bin/env node
//
// dev-console-server.js — tiny HTTP receiver that lets the
// pronunciation-coach pack JS forward its console.log/warn/error
// stream to a file on this Mac. Lets Claude read /tmp/pc-console.log
// after a user interaction without the user copy-pasting Safari
// Web Inspector output.
//
// Listens on :8990 by default. Pack-side wrapper
// (packs/pronunciation-coach/src/devConsole.ts) POSTs JSON to
// /__console with shape { level, args, ts }. We append a timestamped
// line to /tmp/pc-console.log per request.
//
// Run from anywhere on the host:
//   node corpan/scripts/dev-console-server.js
//
// Or use the npm alias once we add it.
//
// **Dev only.** The pack only enables the forwarder when its dev
// manifest is loaded; production builds never POST.

const http = require("http")
const fs = require("fs")

const PORT = Number(process.env.PC_CONSOLE_PORT || 8990)
const LOG_PATH = process.env.PC_CONSOLE_LOG || "/tmp/pc-console.log"

const ALLOW_ORIGIN = "*" // dev only; we're listening on a private LAN port.

function appendLine(line) {
    fs.appendFile(LOG_PATH, line + "\n", (err) => {
        if (err) console.error("[pc-console] append failed:", err.message)
    })
}

const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN)
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") {
        res.writeHead(204)
        res.end()
        return
    }

    if (req.method !== "POST" || req.url !== "/__console") {
        res.writeHead(404)
        res.end("not found")
        return
    }

    let body = ""
    req.on("data", (chunk) => {
        body += chunk
        if (body.length > 256 * 1024) {
            // 256KB cap — pack should never send this much per call.
            req.destroy()
        }
    })
    req.on("end", () => {
        let payload
        try {
            payload = JSON.parse(body)
        } catch {
            res.writeHead(400)
            res.end("bad json")
            return
        }
        const ts = new Date(payload.ts || Date.now()).toISOString()
        const level = String(payload.level || "log").toUpperCase()
        const args = Array.isArray(payload.args) ? payload.args : [payload.args]
        const text = args
            .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
            .join(" ")
        appendLine(`${ts} [${level}] ${text}`)
        res.writeHead(204)
        res.end()
    })
})

server.listen(PORT, "0.0.0.0", () => {
    console.log(`[pc-console] listening on :${PORT}, writing to ${LOG_PATH}`)
})
