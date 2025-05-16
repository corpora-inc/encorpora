import { useSettingsStore, ALL_DOMAINS } from "@/store/settings";
import { Button } from "@/components/ui/button";

const DOMAIN_NAMES: Record<string, string> = {
    travel: "Travel",
    business: "Business",
    education: "Education",
    social: "Social",
    health: "Health",
    housing: "Housing",
    numbers: "Numbers",
    civic: "Civic",
    technology: "Technology",
    environment: "Environment",
    emergency: "Emergency",
    culture: "Culture",
    everyday: "Everyday",
};

export function DomainPicker() {
    const domains = useSettingsStore((s) => s.domains);
    const setDomains = useSettingsStore((s) => s.setDomains);

    const allActive = domains.length === 0 || domains.length === ALL_DOMAINS.length;

    function toggleDomain(code: string) {
        // If "all", switch to just this domain
        if (allActive) {
            setDomains([code]);
        } else if (domains.includes(code)) {
            // Remove this one (leaving empty means "all")
            setDomains(domains.filter((d) => d !== code));
        } else {
            setDomains([...domains, code]);
        }
    }

    function handleSelectAll() {
        setDomains([...ALL_DOMAINS]);
    }


    return (
        <div className="w-full mt-6">
            <div className="mb-2 font-semibold text-sm">Domains</div>
            <div className="flex gap-2 mb-3">
                <Button
                    size="sm"
                    variant={allActive ? "default" : "outline"}
                    onClick={handleSelectAll}
                >
                    Select all
                </Button>
            </div>
            <div className="flex flex-wrap gap-2">
                {ALL_DOMAINS.map((code) => {
                    const selected = allActive || domains.includes(code);
                    return (
                        <Button
                            key={code}
                            type="button"
                            variant={selected ? "default" : "outline"}
                            size="sm"
                            className={`
                                rounded-full text-xs p-3
                                transition
                                ${selected ? "shadow-sm" : ""}
                            `}
                            aria-pressed={selected}
                            onClick={() => toggleDomain(code)}
                        >
                            {DOMAIN_NAMES[code] || code}
                        </Button>
                    );
                })}
            </div>
            <div className="mt-2 text-xs text-gray-400">
                {allActive
                    ? "All domains included."
                    : domains.length === 0
                        ? "No domains selected (all will be included)."
                        : `${domains.length} selected.`}
            </div>
        </div>
    );
}
