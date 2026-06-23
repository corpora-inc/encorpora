// CorpanLlmPlugin.swift
//
// SCAFFOLD ONLY — the polish machine wires this to a vendored llama.xcframework
// built with -DGGML_METAL=ON. The scaffold below shows the Tauri plugin shape
// + the Swift bridge signatures.
//
// Build steps for the polish machine:
//
//   1. Clone llama.cpp into vendor/llama.cpp, pin a commit.
//   2. Build llama.xcframework:
//        cd vendor/llama.cpp
//        ./build-xcframework.sh   # or the equivalent with -DGGML_METAL=ON
//   3. Drop the .xcframework into ios/llama.xcframework/
//   4. Wire Package.swift to link it (see Package.swift skeleton).
//   5. Replace the TODO stubs below with real llama.cpp FFI calls.

import Foundation
import Tauri
import UIKit

@objc class CorpanLlmPlugin: Plugin {

    private var ctx: OpaquePointer?  // llama_context*
    private var model: OpaquePointer?  // llama_model*
    private var backend: String? = nil
    private var modelPackId: String? = nil
    private var activeSessions: [String: Bool] = [:]  // sessionId -> cancellation flag
    private let queue = DispatchQueue(label: "com.corpan.llm.inference", qos: .userInitiated)

    @objc public func llm_status(_ invoke: Invoke) throws {
        let memBytes = ProcessInfo.processInfo.physicalMemory
        let memMb = Int64(memBytes / 1024 / 1024)
        invoke.resolve([
            "loaded": ctx != nil,
            "modelId": modelPackId as Any,
            "backend": backend as Any,
            "availableMemoryMb": memMb,
        ])
    }

    @objc public func llm_load(_ invoke: Invoke) throws {
        struct Args: Decodable {
            let modelPackId: String
            let gpuLayers: Int32?
            let contextSize: UInt32?
        }
        let args = try invoke.parseArgs(Args.self)

        // Resolve the gguf path from the installed pack location.
        let appData = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let ggufUrl = appData
            .appendingPathComponent("corpan-packs")
            .appendingPathComponent(args.modelPackId)
            .appendingPathComponent("model")
            .appendingPathComponent("base.gguf")

        guard FileManager.default.fileExists(atPath: ggufUrl.path) else {
            invoke.reject("MODEL_NOT_FOUND", "GGUF not at \(ggufUrl.path)")
            return
        }

        // TODO (polish machine): real llama.cpp load. Pseudo:
        //
        //   var modelParams = llama_model_default_params()
        //   modelParams.n_gpu_layers = Int32(args.gpuLayers ?? 999)  // try all on Metal
        //   self.model = llama_load_model_from_file(ggufUrl.path, modelParams)
        //   guard self.model != nil else { invoke.reject("LLAMA_CPP_ERROR", ...); return }
        //
        //   var ctxParams = llama_context_default_params()
        //   ctxParams.n_ctx = UInt32(args.contextSize ?? 4096)
        //   self.ctx = llama_new_context_with_model(self.model, ctxParams)
        //   self.backend = "metal"
        //   self.modelPackId = args.modelPackId
        //   invoke.resolve()

        self.backend = "metal"  // stub
        self.modelPackId = args.modelPackId
        invoke.resolve()
    }

    @objc public func llm_chat(_ invoke: Invoke) throws {
        struct Msg: Decodable { let role: String; let content: String }
        struct Opts: Decodable {
            let temperature: Float?
            let topP: Float?
            let repeatPenalty: Float?
            let maxTokens: UInt32?
        }
        struct Args: Decodable {
            let messages: [Msg]
            let options: Opts?
        }
        let args = try invoke.parseArgs(Args.self)
        guard ctx != nil || backend == "metal" else {
            invoke.reject("MODEL_NOT_LOADED", "Call llm_load first")
            return
        }

        let sessionId = UUID().uuidString
        activeSessions[sessionId] = false

        queue.async { [weak self] in
            guard let self = self else { return }

            // TODO (polish machine): real generation loop. Pseudo:
            //
            //   1. Format messages via ChatML template
            //   2. Tokenize prompt with llama_tokenize
            //   3. for each new token until EOS / maxTokens / stop string / cancellation:
            //        - run llama_decode
            //        - sample with llama_sample_token + penalties
            //        - emit "llm-token:{sessionId}" via self.trigger(...)
            //   4. emit "llm-done:{sessionId}" with stats

            // Stub: emit a tiny streaming echo so the UI integration works.
            let text = args.messages.last(where: { $0.role == "user" })?.content ?? ""
            let words = text.split(separator: " ")
            var count: UInt32 = 0
            for w in words {
                if self.activeSessions[sessionId] == true { break }  // cancellation
                self.trigger("llm-token:\(sessionId)", data: ["sessionId": sessionId, "token": String(w) + " "])
                count += 1
                Thread.sleep(forTimeInterval: 0.03)
            }
            self.activeSessions.removeValue(forKey: sessionId)
            self.trigger("llm-done:\(sessionId)", data: ["sessionId": sessionId, "totalTokens": count, "elapsedMs": 0])
        }

        invoke.resolve(sessionId)
    }

    @objc public func llm_stop(_ invoke: Invoke) throws {
        struct Args: Decodable { let sessionId: String }
        let args = try invoke.parseArgs(Args.self)
        if activeSessions[args.sessionId] != nil {
            activeSessions[args.sessionId] = true
        }
        invoke.resolve()
    }

    @objc public func llm_unload(_ invoke: Invoke) throws {
        // TODO (polish machine): real cleanup
        //   if let c = ctx { llama_free(c) }
        //   if let m = model { llama_free_model(m) }
        self.ctx = nil
        self.model = nil
        self.backend = nil
        self.modelPackId = nil
        self.activeSessions.removeAll()
        invoke.resolve()
    }

    @objc public func llm_query_pack_db(_ invoke: Invoke) throws {
        // Bridge to the existing pack-db query path on the JS host side.
        invoke.reject("NOT_IMPLEMENTED", "Use HostApi.queryPackDb from pack JS instead.")
    }
}

@_cdecl("init_plugin_corpan_llm")
func initPlugin() -> Plugin {
    return CorpanLlmPlugin()
}
