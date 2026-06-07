import type { ComponentType } from "react"
import { OnboardingWelcome } from "@/components/OnboardingWelcome"
import { OnboardingPickPrimary } from "@/components/OnboardingPickPrimary"
import { OnboardingWelcomePact } from "@/components/OnboardingWelcomePact"
import { OnboardingPickLearning } from "@/components/OnboardingPickLearning"
import { OnboardingPickPhrasePacks } from "@/components/OnboardingPickPhrasePacks"
import { OnboardingTTSInstructions } from "@/components/OnboardingTTSInstructions"
import { OnboardingFinish } from "@/components/OnboardingFinish"
import type { ComponentKey, OnboardingStepProps } from "./types"

/** Maps graph `adapter` component keys to the actual screens. Each accepts
 *  the optional onAdvance/onBack navigation props. */
export const ONBOARDING_COMPONENTS: Record<ComponentKey, ComponentType<OnboardingStepProps>> = {
  welcome: OnboardingWelcome,
  pickPrimary: OnboardingPickPrimary,
  welcomePact: OnboardingWelcomePact,
  pickLearning: OnboardingPickLearning,
  pickPhrasePacks: OnboardingPickPhrasePacks,
  tts: OnboardingTTSInstructions,
  finish: OnboardingFinish,
}
