import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { normalizeJoinCode } from "../../../../schools/contracts";
import { Avatar } from "../../../ui/Avatar";
import { buttonClass } from "../../../ui/Button";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { ProviderMark } from "../../auth/ProviderButtons";
import { PracticeGate } from "../../practice/StudentWaiting";
import { joinRosterOptions } from "./api";
import { JoinFrame } from "./JoinFrame";
import styles from "./Join.module.css";

export function BackLink({
  label,
  ...to
}: { label: string } & (
  | { to: "/join"; params?: undefined }
  | {
      to: "/join/$code";
      params: { code: string };
    }
)) {
  return (
    <Link {...to} className={styles.back} aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </Link>
  );
}

/** A code that doesn't lead anywhere: why, and the way back. */
export function JoinProblem({ message }: { message: string }) {
  return (
    <JoinFrame>
      <div className={styles.column} data-centered>
        <div role="alert">
          <h1 className={styles.title}>{message}</h1>
        </div>
        <Link to="/join" className={buttonClass("primary", styles.bigButton)}>
          Type a class code
        </Link>
      </div>
    </JoinFrame>
  );
}

/** In a child's words: what happened with their school account, and what to do. */
const SSO_MESSAGES: Record<string, string> = {
  not_on_roster: "That account isn’t on your class list.",
  email_unverified: "That account’s email couldn’t be confirmed.",
  declined: "Sign-in was cancelled.",
  expired: "That took too long.",
  failed: "That didn’t work.",
};
const PROVIDER_NAMES = { google: "Google", microsoft: "Microsoft" } as const;

/** `/join/$code`: the class, as big names to tap. */
export function ClassScreen() {
  const params = useParams({ from: "/join/$code" });
  const code = normalizeJoinCode(params.code);
  const navigate = useNavigate();
  const roster = useQuery(joinRosterOptions(code));
  const { sso } = useSearch({ strict: false }) as { sso?: unknown };
  const problem = typeof sso === "string" ? SSO_MESSAGES[sso] : undefined;
  useEffect(() => {
    if (problem) console.error("School account sign-in stopped", sso);
  }, [problem, sso]);
  // A shared link's `abc-def` becomes the one address for this class.
  useEffect(() => {
    if (code && code !== params.code)
      void navigate({
        to: "/join/$code",
        params: { code },
        replace: true,
      });
  }, [code, params.code, navigate]);
  if (roster.isError && !roster.data)
    return <JoinProblem message={roster.error.message} />;
  if (!roster.data) return <LoadingScreen />;
  // Practice isn't open: say so here, before a name and three pictures.
  if (roster.data.practice)
    return (
      <JoinFrame lead={<BackLink to="/join" label="Back to class code" />}>
        <PracticeGate
          gate={roster.data.practice}
          className={roster.data.class.name}
        />
      </JoinFrame>
    );
  return (
    <JoinFrame lead={<BackLink to="/join" label="Back to class code" />}>
      <div className={styles.wide}>
        <h1 className={styles.title}>Tap your name</h1>
        <p className={styles.subtitle}>{roster.data.class.name}</p>
        {!!roster.data.signIn?.length && (
          <div className={styles.accounts}>
            {roster.data.signIn.map((provider) => (
              <a
                key={provider}
                className={styles.accountButton}
                href={`/api/v1/school/join/oidc/${provider}/start?code=${code}`}
              >
                <ProviderMark provider={provider} />
                <span>Sign in with {PROVIDER_NAMES[provider]}</span>
              </a>
            ))}
          </div>
        )}
        {problem && (
          <p className={styles.problem} role="alert">
            {problem} Tap your name below, or{" "}
            <Link to="/join" className={styles.problemLink}>
              scan your card
            </Link>
            .
          </p>
        )}
        {roster.data.students.length ? (
          <ul className={styles.names}>
            {roster.data.students.map((student) => (
              <li key={student.id}>
                <Link
                  to="/join/$code/$person"
                  params={{ code, person: student.id }}
                  className={styles.nameTile}
                >
                  <Avatar name={student.name} size="fill" />
                  <span>{student.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.problem}>
            No names here yet. Ask your teacher to add you.
          </p>
        )}
      </div>
    </JoinFrame>
  );
}
