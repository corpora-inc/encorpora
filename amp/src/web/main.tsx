// Every document but the signed-out pitch's: `/` is `home.html`, whose light
// entry (`home-entry.tsx`) starts this same app when it's needed.
import { bootApp } from "./app/boot";

bootApp();
