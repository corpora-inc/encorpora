import Link from "next/link";

// The return address registered with the Free2Z SDK (aha/aha-app/src-tauri/src/f2z.rs).
// ¡AHA! sells nothing, so this page only sends the reader back to the app.
export const metadata = {
  title: "Return to ¡AHA! — Corpora",
  description: "Return to the ¡AHA! app.",
};

export default function AhaPurchaseReturnPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f1] px-6 py-16 text-[#263d35]">
      <article className="mx-auto max-w-xl space-y-6 leading-relaxed">
        <Link href="/aha" className="text-sm underline">¡AHA!</Link>
        <h1 className="font-serif text-4xl">Return to ¡AHA!</h1>
        <p>You can close this page and return to the app.</p>
        <p>This page does not read anything from the address and does not change your Free2Z account.</p>
        <Link href="/aha/support" className="inline-block underline">Get help</Link>
      </article>
    </main>
  );
}
