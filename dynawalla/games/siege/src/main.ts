/** Standalone dev entry: the local stub Host, mounted into #app. */
import { mount } from "./index.ts";
import { createStubHost } from "./stubHost.ts";

const app = document.getElementById("app");
if (!app) throw new Error("#app missing");

const host = createStubHost({ seed: 0xf0a9e, difficulty: 0.12 });
const game = mount(app, host);

(globalThis as unknown as { __siegeHost?: unknown }).__siegeHost = host;
(globalThis as unknown as { __siegeMount?: unknown }).__siegeMount = game;
