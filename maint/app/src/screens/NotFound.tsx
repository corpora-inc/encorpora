import { ButtonLink, Page } from "../ui/kit.tsx";

export function NotFound() {
  return (
    <Page title="Nothing here">
      <p className="text-body text-ink-2">This address is not a screen in the app.</p>
      <div>
        <ButtonLink to="/" variant="primary">
          Fleet
        </ButtonLink>
      </div>
    </Page>
  );
}
