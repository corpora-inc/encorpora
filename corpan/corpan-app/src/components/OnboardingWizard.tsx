import { useSettingsStore } from "@/store/settings";
import { OnboardingWelcome } from "./OnboardingWelcome";
import { OnboardingPickPrimary } from "./OnboardingPickPrimary";
import { OnboardingPickLearning } from "./OnboardingPickLearning";
// import { OnboardingFinish } from "./OnboardingFinish";

export function OnboardingWizard() {
    const step = useSettingsStore(s => s.onboardingStep);

    switch (step) {
        case 0:
            return <OnboardingWelcome />;
        case 1:
            return <OnboardingPickPrimary />;
        case 2:
            return <OnboardingPickLearning />;
        // case 3:
        //     return <OnboardingFinish />;
        default:
            return <OnboardingWelcome />;
    }
}


// import { useState } from "react";
// import { useSettingsStore, ALL_LANGUAGES } from "@/store/settings";
// import { TranslationKey, TRANSLATIONS } from "@/store/translations";
// import { Button } from "@/components/ui/button";
// import { ChevronRight, ChevronLeft, ArrowRightCircle } from "lucide-react";

// // OnboardingWizard: Zero English hardcoding, always natural UX for any user
// export function OnboardingWizard() {
//     const setOnboarded = useSettingsStore((s) => s.setOnboarded);
//     const setLanguages = useSettingsStore((s) => s.setLanguages);

//     // Don't use state defaults in English—use device or guess later if you want
//     const [step, setStep] = useState(0);
//     const [primary, setPrimary] = useState<string | null>(null);
//     const [learning, setLearning] = useState<string[]>([]);

//     // t() is only usable after primary is picked, so for step 1/2 only
//     const t = (code: string) => {
//         if (!primary) return TRANSLATIONS["en"][code as keyof typeof TRANSLATIONS["en"]] || code;
//         const base = primary.split("-")[0] as keyof typeof TRANSLATIONS;
//         return (
//             TRANSLATIONS[primary as keyof typeof TRANSLATIONS]?.[code as keyof typeof TRANSLATIONS["en"]] ??
//             TRANSLATIONS[base]?.[code as keyof typeof TRANSLATIONS["en"]] ??
//             TRANSLATIONS["en"][code as keyof typeof TRANSLATIONS["en"]] ??
//             code
//         );
//     };

//     // --- STEP 0: WELCOME (all languages) ---
//     if (step === 0) {
//         const welcomes = ALL_LANGUAGES.map(
//             (code) =>
//                 TRANSLATIONS[code as keyof typeof TRANSLATIONS]?.["welcome" as TranslationKey] ??
//                 TRANSLATIONS[code as keyof typeof TRANSLATIONS]?.["en" as TranslationKey] ??
//                 code
//         );

//         return (
//             <div className="flex flex-col items-center justify-center min-h-screen w-full bg-white relative">
//                 <div className="relative w-96 h-96 flex items-center justify-center mb-8">
//                     {/* Circle of welcomes */}
//                     {welcomes.map((w, i) => {
//                         const angle = (2 * Math.PI * i) / welcomes.length;
//                         const radius = 150;
//                         const x = Math.cos(angle) * radius + 192;
//                         const y = Math.sin(angle) * radius + 192;
//                         return (
//                             <span
//                                 key={i}
//                                 className="absolute text-md font-medium select-none"
//                                 style={{
//                                     left: x,
//                                     top: y,
//                                     transform: "translate(-50%, -50%)",
//                                     whiteSpace: "nowrap",
//                                     color: "#555",
//                                 }}
//                             >
//                                 {w}
//                             </span>
//                         );
//                     })}
//                     {/* Big Next Button in center */}
//                     <button
//                         aria-label="Next"
//                         className="
//               absolute left-1/2 top-1/2
//               transform -translate-x-1/2 -translate-y-1/2
//               bg-black hover:bg-gray-900 text-white shadow-2xl
//               rounded-full p-8 transition
//               flex items-center justify-center
//               outline-none ring-0 border-none
//             "
//                         style={{ fontSize: "3rem", boxShadow: "0 8px 32px 0 #0003" }}
//                         onClick={() => setStep(1)}
//                     >
//                         <ArrowRightCircle size={64} />
//                     </button>
//                 </div>
//             </div>
//         );
//     }

//     // --- STEP 1: PICK PRIMARY LANGUAGE ---
//     if (step === 1) {
//         return (
//             <div className="flex flex-col items-center justify-center min-h-screen w-full bg-white">
//                 <div className="flex items-center w-full mb-8">
//                     <button
//                         aria-label="Back"
//                         className="mr-auto p-3 rounded-full hover:bg-gray-100"
//                         onClick={() => setStep(0)}
//                     >
//                         <ChevronLeft size={32} />
//                     </button>
//                     <h2 className="text-2xl font-semibold flex-1 text-center">{/* no text, minimal */}</h2>
//                     <div className="ml-auto w-12" /> {/* For symmetry */}
//                 </div>
//                 <div className="text-lg font-medium mb-3 text-gray-500">
//                     {/* Optionally a globe or icon, but no text */}
//                 </div>
//                 <div className="flex flex-wrap gap-3 justify-center mb-8 max-w-2xl">
//                     {ALL_LANGUAGES.map((code) => (
//                         <Button
//                             key={code}
//                             variant={primary === code ? "default" : "outline"}
//                             className="px-4 py-2 rounded-full"
//                             onClick={() => setPrimary(code)}
//                         >
//                             {TRANSLATIONS[code as keyof typeof TRANSLATIONS]?.[code as TranslationKey] || code}
//                         </Button>
//                     ))}
//                 </div>
//                 <button
//                     aria-label="Next"
//                     disabled={!primary}
//                     onClick={() => primary && setStep(2)}
//                     className={`
//             bg-black hover:bg-gray-900 text-white rounded-full
//             p-5 shadow-lg flex items-center justify-center transition
//             disabled:opacity-30 disabled:cursor-not-allowed
//           `}
//                 >
//                     <ChevronRight size={40} />
//                 </button>
//             </div>
//         );
//     }

//     // --- STEP 2: PICK LANGUAGES TO LEARN ---
//     if (step === 2) {
//         return (
//             <div className="flex flex-col items-center justify-center min-h-screen w-full bg-white">
//                 <div className="flex items-center w-full mb-8">
//                     <button
//                         aria-label="Back"
//                         className="mr-auto p-3 rounded-full hover:bg-gray-100"
//                         onClick={() => setStep(1)}
//                     >
//                         <ChevronLeft size={32} />
//                     </button>
//                     <h2 className="text-2xl font-semibold flex-1 text-center">{/* no text, minimal */}</h2>
//                     <div className="ml-auto w-12" />
//                 </div>
//                 <div className="flex flex-wrap gap-3 justify-center mb-8 max-w-2xl">
//                     {ALL_LANGUAGES.filter((code) => code !== primary).map((code) => (
//                         <Button
//                             key={code}
//                             variant={learning.includes(code) ? "default" : "outline"}
//                             className="px-4 py-2 rounded-full"
//                             onClick={() =>
//                                 setLearning((l) =>
//                                     l.includes(code) ? l.filter((c) => c !== code) : [...l, code]
//                                 )
//                             }
//                         >
//                             {t(code)}
//                         </Button>
//                     ))}
//                 </div>
//                 <button
//                     aria-label="Next"
//                     disabled={learning.length === 0}
//                     onClick={() => setStep(3)}
//                     className={`
//             bg-black hover:bg-gray-900 text-white rounded-full
//             p-5 shadow-lg flex items-center justify-center transition
//             disabled:opacity-30 disabled:cursor-not-allowed
//           `}
//                 >
//                     <ChevronRight size={40} />
//                 </button>
//             </div>
//         );
//     }

//     // --- STEP 3: FINISH / TTS DIRECTIONS (add more here later) ---
//     if (step === 3) {
//         // In a real app, show TTS info, device-specific links, etc, per primary lang/platform
//         return (
//             <div className="flex flex-col items-center justify-center min-h-screen w-full bg-white">
//                 <div className="flex items-center w-full mb-8">
//                     <button
//                         aria-label="Back"
//                         className="mr-auto p-3 rounded-full hover:bg-gray-100"
//                         onClick={() => setStep(2)}
//                     >
//                         <ChevronLeft size={32} />
//                     </button>
//                     <div className="flex-1" />
//                     <div className="ml-auto w-12" />
//                 </div>
//                 <div className="text-2xl font-semibold mb-4">
//                     {/* No text, but you can show a checkmark or nice icon */}
//                     <span role="img" aria-label="ready">🎉</span>
//                 </div>
//                 <Button
//                     className="mt-10 px-12 py-4 rounded-full shadow-xl text-lg"
//                     onClick={() => {
//                         setLanguages([primary!, ...learning]);
//                         setOnboarded(true);
//                     }}
//                 >
//                     <ChevronRight size={40} />
//                 </Button>
//             </div>
//         );
//     }

//     return null;
// }
