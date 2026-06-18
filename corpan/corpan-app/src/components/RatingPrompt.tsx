// src/components/RatingPrompt.tsx

import { motion, AnimatePresence } from "framer-motion";
import { Star, X, Heart, Github, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useRatingStore } from "@/store/rating";
import { openUrl } from "@tauri-apps/plugin-opener";
import { detectPlatform } from "@/lib/getPlatform";
import { requestNativeReview } from "@/contentPacks/purchase";
import { glass } from "@/util/browser";

const FALLBACK = "https://github.com/corpora-inc/encorpora";
const GITHUB_ISSUES = "https://github.com/corpora-inc/encorpora/issues";
const SUPPORT_EMAIL = "team@encorpora.io";

const platforms = [
	{
		name: "ios",
		link: "https://apps.apple.com/gb/app/corp%C3%A1n/id6746082061",
	},
	{
		name: "mac",
		link: "https://apps.apple.com/gb/app/corp%C3%A1n/id6746082061",
	},
	{
		name: "android",
		link: "https://play.google.com/store/apps/details?id=com.corpora.corpan",
	},
];

export function RatingPrompt() {
	const { t } = useTranslation();

	// Manual-only: the card shows solely when promptManualReview() has opened it
	// (Settings → About "Rate Corpán"). It never auto-appears.
	const show = useRatingStore((s) => s.isOpen);

	const dismissPrompt = useRatingStore((s) => s.dismissPrompt);
	const rateApp = useRatingStore((s) => s.rateApp);

	const handleRate = async () => {
		rateApp();

		try {
			const platformName = await detectPlatform();
			// On mobile, pop the OS-native review widget (StoreKit / Play In-App
			// Review) instead of bouncing out to the store listing. Desktop has no
			// native review sheet, so fall back to the store URL there.
			if (platformName === "ios" || platformName === "android") {
				await requestNativeReview();
				return;
			}
			const storeUrl =
				platforms.find((p) => p.name === platformName)?.link ?? FALLBACK;
			await openUrl(storeUrl);
		} catch (error) {
			// console.error("Failed to open native review / store:", error);
			await openUrl(FALLBACK);
		}
	};

	const handleDismiss = () => {
		dismissPrompt();
	};

	const dismissForFeedback = () => {
		// Treat giving feedback as "I've engaged, don't nag me again"
		dismissPrompt();
	};

	const handleEmailFeedback = async () => {
		dismissForFeedback();

		try {
			await openUrl(`mailto:${SUPPORT_EMAIL}?subject=Corp%C3%A1n%20feedback`);
		} catch (error) {
			await openUrl(FALLBACK);
		}
	};

	const handleGithubFeedback = async () => {
		dismissForFeedback();

		try {
			await openUrl(GITHUB_ISSUES);
		} catch (error) {
			// console.error("Failed to open GitHub issues:", error);
			await openUrl(FALLBACK);
		}
	};

	return (
		<AnimatePresence>
			{show && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className={`fixed inset-0 z-100 ${glass("bg-black/25 backdrop-blur-sm", "bg-black/45")}`}
						onClick={handleDismiss}
					/>

					{/* Prompt Card */}
					<motion.div
						initial={{ opacity: 0, scale: 0.96, y: 12 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 12 }}
						transition={{
							type: "spring",
							stiffness: 260,
							damping: 24,
						}}
						className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-101 w-[90%] max-w-md"
					>
						<div className="bg-background rounded-3xl shadow-2xl p-6 sm:p-7 relative overflow-hidden border border-black/5">
							{/* Close button */}
							<button
								onClick={handleDismiss}
								className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
								aria-label={t("rating.close" as any)}
							>
								<X size={24} />
							</button>

							{/* Icon */}
							<motion.div
								initial={{ scale: 0.8, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								transition={{
									delay: 0.1,
									type: "spring",
									stiffness: 220,
									damping: 18,
								}}
								className="flex justify-center mb-4"
							>
								<div className="bg-linear-to-br from-purple-400 to-purple-600 rounded-full p-4 shadow-md">
									<Heart
										className="text-white"
										size={30}
										fill="white"
									/>
								</div>
							</motion.div>

							{/* Title */}
							<motion.h3
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.15 }}
								className="text-xl font-semibold text-center text-foreground mb-1"
							>
								{t("rating.title" as any)}
							</motion.h3>

							{/* Description */}
							<motion.p
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.2 }}
								className="text-center text-muted-foreground mb-3 text-sm leading-relaxed"
							>
								{t("rating.description" as any)}
							</motion.p>

							{/* Feedback hint */}
							<motion.p
								initial={{ opacity: 0, y: 4 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.25 }}
								className="text-center text-muted-foreground mb-5 text-xs leading-snug"
							>
								{t("rating.feedbackHint" as any)}
							</motion.p>

							{/* Stars decoration */}
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.3 }}
								className="flex justify-center gap-1.5 mb-6"
							>
								{[1, 2, 3, 4, 5].map((star, index) => (
									<motion.div
										key={star}
										initial={{ opacity: 0, scale: 0.7 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{
											delay: 0.3 + index * 0.04,
											type: "spring",
											stiffness: 260,
											damping: 20,
										}}
									>
										<Star
											className="text-purple-400"
											size={22}
											fill="#c084fc"
										/>
									</motion.div>
								))}
							</motion.div>

							{/* Primary action first; feedback paths are for anything short of 5 stars. */}
							<motion.div
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.35 }}
								className="flex flex-col gap-2 mb-3"
							>
								<Button
									onClick={handleRate}
									size="lg"
									className="w-full justify-center rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
								>
									{t("rating.rateNow" as any)}
								</Button>

								<Button
									onClick={handleEmailFeedback}
									variant="outline"
									size="lg"
									className="w-full justify-center gap-2 border-border text-foreground hover:bg-accent rounded-xl"
								>
									<Mail className="h-4 w-4" />
									{t("rating.emailButton" as any)}
								</Button>

								<Button
									onClick={handleGithubFeedback}
									variant="outline"
									size="lg"
									className="w-full justify-center gap-2 border-border text-foreground hover:bg-accent rounded-xl"
								>
									<Github className="h-4 w-4" />
									{t("rating.githubButton" as any)}
								</Button>
							</motion.div>

							{/* Secondary action: close */}
							<motion.div
								initial={{ opacity: 0, y: 4 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.4 }}
								className="mt-3 flex items-center justify-center text-xs text-muted-foreground"
							>
								<button
									onClick={handleDismiss}
									className="underline-offset-2 hover:underline cursor-pointer"
								>
									{t("rating.close" as any)}
								</button>
							</motion.div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
