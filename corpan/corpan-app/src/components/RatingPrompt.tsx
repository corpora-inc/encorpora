import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useRatingStore } from "@/store/rating";
import { openUrl } from "@tauri-apps/plugin-opener";
import { detectPlatform } from "@/lib/getPlatform";
const platforms = [
	{
		name: "ios",
		link: "https://apps.apple.com/gb/app/corp%C3%A1n/id6746082061",
	},
	{
		name: "android",
		link: "https://play.google.com/store/apps/details?id=com.corpora.corpan",
	},
];

export function RatingPrompt() {
	const { t } = useTranslation();
	const [isVisible, setIsVisible] = useState(false);

	const shouldShowPrompt = useRatingStore((s) => s.shouldShowPrompt);
	const dismissPrompt = useRatingStore((s) => s.dismissPrompt);
	const rateApp = useRatingStore((s) => s.rateApp);
	const remindLater = useRatingStore((s) => s.remindLater);

	useEffect(() => {
		// Check if we should show the prompt after a short delay
		const timer = setTimeout(() => {
			if (shouldShowPrompt()) {
				setIsVisible(true);
			}
		}, 2000); // Wait 2 seconds before checking

		return () => clearTimeout(timer);
	}, [shouldShowPrompt]);

	const handleRate = async () => {
		rateApp();
		setIsVisible(false);

		try {
			const platformName = await detectPlatform();
			const storeUrl =
				platforms.find((p) => p.name === platformName)?.link ??
				"https://github.com/0bkevin/encorpora"; // Fallback for desktop

			await openUrl(storeUrl);
		} catch (error) {
			console.error("Failed to open store:", error);
			// Fallback for web environment or if Tauri API fails
			await openUrl("https://github.com/0bkevin/encorpora");
		}
	};

	const handleDismiss = () => {
		dismissPrompt();
		setIsVisible(false);
	};

	const handleRemindLater = () => {
		remindLater();
		setIsVisible(false);
	};

	return (
		<AnimatePresence>
			{isVisible && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.3 }}
						className="fixed inset-0 bg-black/20 backdrop-blur-sm z-100"
						onClick={handleRemindLater}
					/>

					{/* Prompt Card */}
					<motion.div
						initial={{ opacity: 0, scale: 0.9, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.9, y: 20 }}
						transition={{
							type: "spring",
							stiffness: 300,
							damping: 25,
							duration: 0.4,
						}}
						className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-101 w-[90%] max-w-md"
					>
						<div className="bg-white rounded-2xl shadow-2xl p-6 relative overflow-hidden">
							{/* Close button */}
							<button
								onClick={handleDismiss}
								className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
								aria-label={t("rating.close" as any)}
							>
								<X size={20} />
							</button>

							{/* Icon */}
							<motion.div
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								transition={{
									delay: 0.2,
									type: "spring",
									stiffness: 200,
								}}
								className="flex justify-center mb-4"
							>
								<div className="bg-linear-to-br from-purple-400 to-purple-600 rounded-full p-4">
									<Heart className="text-white" size={32} fill="white" />
								</div>
							</motion.div>

							{/* Title */}
							<motion.h3
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.3 }}
								className="text-xl font-semibold text-center text-gray-800 mb-2"
							>
								{t("rating.title" as any)}
							</motion.h3>

							{/* Description */}
							<motion.p
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.35 }}
								className="text-center text-gray-600 mb-6 text-sm leading-relaxed"
							>
								{t("rating.description" as any)}
							</motion.p>

							{/* Stars decoration */}
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.4 }}
								className="flex justify-center gap-2 mb-6"
							>
								{[1, 2, 3, 4, 5].map((star, index) => (
									<motion.div
										key={star}
										initial={{ opacity: 0, scale: 0 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{
											delay: 0.4 + index * 0.05,
											type: "spring",
											stiffness: 200,
										}}
									>
										<Star
											className="text-purple-400"
											size={24}
											fill="#c084fc"
										/>
									</motion.div>
								))}
							</motion.div>

							{/* Buttons */}
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.5 }}
								className="flex flex-col gap-2"
							>
								<Button
									onClick={handleRate}
									size="lg"
									
									className="w-full bg-linear-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium shadow-md"
								>
									{t("rating.rateNow" as any)}
								</Button>

								<div className="flex gap-2">
									<Button
										onClick={handleRemindLater}
										variant="outline"
										size="sm"
										className="flex-1 text-gray-600"
									>
										{t("rating.remindLater" as any)}
									</Button>

									<Button
										onClick={handleDismiss}
										variant="ghost"
										size="sm"
										className="flex-1 text-gray-500"
									>
										{t("rating.noThanks" as any)}
									</Button>
								</div>
							</motion.div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
