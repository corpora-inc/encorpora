# Changelog — corpan-asr-contract

All notable changes to the shared ASR contract crate. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Initial `AsrProvider` wire contract: `AsrCapability` (provider id,
  languages, on-device, model/resident MB, streaming, latency class,
  needs-download, autoregressive), session structs (`TranscribeArgs`,
  `TranscriptOut`, `PartialEvent`, `LevelEvent`, `SessionErrorEvent`),
  availability/ensure probes, and the canonical `commands` names. The serde
  wire-format gatekeeper for the four provider-per-runtime ASR plugins, with
  the uppercase-`MB` rename trap pinned by tests. Pairs with the TS twin in
  `packs/shared/asr`. See `corpan/docs/STT_MASTERPLAN.md`.
