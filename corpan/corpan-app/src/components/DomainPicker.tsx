import { Button } from "@/components/ui/button";
import { useSettingsStore, ALL_DOMAINS } from "@/store/settings";
import { useTranslation } from "react-i18next";


export function DomainPicker() {
    const domains = useSettingsStore((s) => s.domains);
    const setDomains = useSettingsStore((s) => s.setDomains);
    const dir = useSettingsStore((s) => s.dir());
    const { t } = useTranslation()

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
        <div className="w-full mt-3">
            <div className="mb-2 font-semibold text-sm dark:text-gray-200" dir={dir}>{t("settings.domains")}</div>
            <div className="flex gap-2 mb-3" dir={dir}>
                <Button
                    size="sm"
                    variant={allActive ? "default" : "outline"}
                    onClick={handleSelectAll}
                >
                    {t("settings.selectAll")}
                </Button>
            </div>
            <div className="flex flex-wrap gap-2" dir={dir}>
                {ALL_DOMAINS.map((code) => {
                    const selected = allActive || domains.includes(code);
                    return (
                        <Button
                            key={code}
                            type="button"
                            variant={selected ? "default" : "outline"}
                            size="sm"
                            className={`
                                rounded-md text-xs p-3
                                transition
                                ${selected ? "shadow-sm" : ""}
                            `}
                            aria-pressed={selected}
                            onClick={() => toggleDomain(code)}
                            dir={dir}
                        >
                            {/* {DOMAIN_NAMES[code] || code} */}
                            {/* TODO */}
                            {t(`categories.${code}` as any) || code}
                        </Button>
                    );
                })}
            </div>
            <div className="mt-2 text-xs text-gray-400 dark:text-gray-500" dir={dir}>
                {allActive
                    ? t("settings.allDomainsIncluded")
                    : `${domains.length} ${t("settings.selected")}.`}
            </div>
        </div>
    );
}
