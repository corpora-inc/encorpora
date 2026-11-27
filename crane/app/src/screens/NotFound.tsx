import { Page, ButtonLink } from "../ui/kit.tsx";
import { useT } from "../ui/useT.ts";

export function NotFound() {
  const t = useT();
  return (
    <Page title={t("notFound.title")}>
      <p className="m-0">{t("notFound.body")}</p>
      <ButtonLink to="/ask" variant="primary" className="self-start">
        {t("notFound.home")}
      </ButtonLink>
    </Page>
  );
}
