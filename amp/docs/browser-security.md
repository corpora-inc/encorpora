# Browser tooling security

Repository Chromium tools use `amp/browser-security.mjs`. It selects Chrome for Testing 156.0.8078.80, enables Chromium sandboxing, and checks the running browser version before returning it to a caller. Playwright remains the automation library; its bundled Chromium is not used. Firefox, WebKit, and connections to existing native WebViews keep their engine-specific behavior.

From the repository root, install the browser with:

```sh
node amp/scripts/install-browser.mjs
```

The installer downloads the pinned version from Google's HTTPS Chrome for Testing archive into `~/.cache/corpora-chrome`. `CORPORA_CHROME_CACHE` selects a shared installation directory. `CORPORA_CHROME_PATH` selects an already installed executable; the launch helper still validates its version. A missing or outdated browser stops the operation before loading content. Update the pin and minimum accepted version when reviewing browser security releases. Updating ordinary Chrome or reinstalling Playwright does not update this cache.

Linux containers use [the reviewed seccomp profile](../docker/chromium-seccomp.json), derived from Playwright’s [Docker profile](https://github.com/microsoft/playwright/blob/v1.64.1/utils/docker/seccomp_profile.json) with `chroot` allowed for Chromium’s namespace sandbox. The upstream [license](../docker/PLAYWRIGHT-LICENSE) and [notice](../docker/PLAYWRIGHT-NOTICE) accompany the profile. They require a seccomp profile that permits Chromium's namespace operations (`clone`, `setns`, `unshare`, and `chroot`) in addition to the ordinary runtime allowlist. Keep the non-root user, read-only root filesystem, dropped capabilities, and no privilege escalation. Install the reviewed profile on each Kubernetes node and select it with a `Localhost` seccomp profile before deploying the render image. Verify a real workbook PDF on stage before production. Do not solve sandbox failures with privileged containers or `SYS_ADMIN`.

Docker's publication build runs trusted, repository-generated documents as root in its disposable build environment. Only `scripts/publication-render.ts` and `scripts/publish-book.ts` opt into the root build exception, and only when the build command explicitly sets `CORPORA_PDF_BUILD=1`. The patched-browser version check also applies there. Runtime rendering and development tools require the Chromium sandbox.

Browser automation has the permissions of its host process. Browse untrusted sites in a disposable environment without mounted credentials or personal files, with restricted network access. Browser contexts and offline request interception do not replace operating-system isolation or security patches.
