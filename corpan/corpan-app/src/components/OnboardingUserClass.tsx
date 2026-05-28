import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useSettingsStore, type UserClass, type GoalIntensity, type AgeBand } from "@/store/settings"
import { Button } from "@/components/ui/button"

// Default study cadence per class — PickLearning can refine for learners.
const INTENSITY_BY_CLASS: Record<UserClass, GoalIntensity> = {
  kid_native: "casual",
  enjoyer: "casual",
  learner: "daily",
  polyglot: "intensive",
}

/**
 * Onboarding step 2 — "Who's this for?". Rendered AFTER primary language so
 * every label here is in the user's chosen language. Routes the rest of
 * onboarding: learners/polyglots pick target languages + voices; enjoyers and
 * kids skip straight to the Plus pitch.
 */
export function OnboardingUserClass() {
  const { t } = useTranslation()
  const setStep = useSettingsStore((s) => s.setOnboardingStep)
  const setUserProfile = useSettingsStore((s) => s.setUserProfile)
  const dir = useSettingsStore((s) => s.dir)

  const [selected, setSelected] = useState<UserClass | null>(null)
  const [age, setAge] = useState<AgeBand | null>(null)

  const options: { value: UserClass; label: string; desc: string }[] = [
    {
      value: "learner",
      label: t("onboarding.class.learner", "I'm learning languages"),
      desc: t("onboarding.class.learnerDesc", "Read and listen in the languages you're studying."),
    },
    {
      value: "enjoyer",
      label: t("onboarding.class.enjoyer", "I want to enjoy the content"),
      desc: t("onboarding.class.enjoyerDesc", "Books, stories and games in your own language."),
    },
    {
      value: "polyglot",
      label: t("onboarding.class.polyglot", "Both — I want it all"),
      desc: t("onboarding.class.polyglotDesc", "Several languages at once, plus everything else."),
    },
    {
      value: "kid_native",
      label: t("onboarding.class.kid", "It's for a kid"),
      desc: t("onboarding.class.kidDesc", "Curated books and learning games for younger readers."),
    },
  ]

  const canNext = selected !== null && (selected !== "kid_native" || age !== null)

  const handleNext = () => {
    if (!selected) return
    setUserProfile({
      userClass: selected,
      goalIntensity: INTENSITY_BY_CLASS[selected],
      ...(selected === "kid_native" && age ? { ageBand: age } : { ageBand: "adult" as AgeBand }),
    })
    // learners + polyglots configure languages & voices; others go to pitch.
    if (selected === "learner" || selected === "polyglot") setStep(3)
    else setStep(5)
  }

  return (
    <section
      className="flex h-dvh min-h-[100svh] w-full flex-col overflow-y-auto bg-background md:bg-muted px-5 pt-10"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
      dir={dir()}
    >
      <div className="mx-auto w-full max-w-md flex-1">
        <h1 className="text-2xl font-bold">{t("onboarding.class.title", "Who's this for?")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "onboarding.class.subtitle",
            "We'll tailor Corpán to you. This stays on your device — we never send it anywhere."
          )}
        </p>

        <div className="mt-6 space-y-3">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                setSelected(o.value)
                if (o.value !== "kid_native") setAge(null)
              }}
              className={`w-full rounded-xl border p-4 text-start transition-colors ${
                selected === o.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <div className="font-semibold">{o.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{o.desc}</div>
            </button>
          ))}
        </div>

        {selected === "kid_native" ? (
          <div className="mt-5">
            <p className="text-sm font-medium">{t("onboarding.class.ageTitle", "How old is the reader?")}</p>
            <div className="mt-2 flex gap-2">
              {([
                ["under_13", t("onboarding.class.ageUnder13", "Under 13")],
                ["teen", t("onboarding.class.ageTeen", "13–17")],
              ] as [AgeBand, string][]).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAge(val)}
                  className={`flex-1 rounded-lg border p-3 text-center text-sm transition-colors ${
                    age === val ? "border-primary bg-primary/10 font-medium" : "border-border"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mx-auto mt-6 flex w-full max-w-md gap-3">
        <Button variant="outline" className="!h-12 flex-1" onClick={() => setStep(1)}>
          {t("onboarding.back", "Back")}
        </Button>
        <Button className="!h-12 flex-[2]" disabled={!canNext} onClick={handleNext}>
          {t("onboarding.continue", "Continue")}
        </Button>
      </div>
    </section>
  )
}
