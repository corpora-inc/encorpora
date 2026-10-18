import { startServer } from "./server.js";
const { server, url } = await startServer();
console.log(`Local: ${url}`);
process.on("SIGINT", () => server.close());
process.on("SIGTERM", () => server.close());
