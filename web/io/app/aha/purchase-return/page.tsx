import Link from "next/link";

export const metadata = {
  title: "Return to ¡AHA! — Corpora",
  description: "Return to the AHA app to check your Free2Z purchase status.",
};

export default function AhaPurchaseReturnPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f1] px-6 py-16 text-[#263d35]">
      <article className="mx-auto max-w-xl space-y-6 leading-relaxed">
        <Link href="/aha" className="text-sm underline">¡AHA!</Link>
        <h1 className="font-serif text-4xl">Return to your learning app</h1>
        <p>You can close this browser and return to ¡AHA!. Open the grown-up account area to check the purchase and refresh your Free2Z balance.</p>
        <p>Reaching this page does not confirm payment or added credits. The app checks the purchase with Free2Z; a pending purchase may take time to finish. Avoid starting a duplicate purchase while the first is pending.</p>
        <p>This page does not read purchase details from the address or change your balance.</p>
        <Link href="/aha/support" className="inline-block underline">Get help</Link>
      </article>
    </main>
  );
}
