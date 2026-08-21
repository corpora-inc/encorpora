// MOVED: the storage service now lives at src/lib/storage/ (Journey W1,
// storage-analytics.md §3.1). This one-release re-export shim keeps old
// import paths compiling; new code must import from "@/lib/storage".
// TODO(journey/W1): delete this shim one release after the re-home ships.
export * from "../../lib/storage"
