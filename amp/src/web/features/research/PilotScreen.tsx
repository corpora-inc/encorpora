import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import {
  pilotBands,
  pilotInterestSchema,
  pilotPlaces,
  pilotRoles,
  pilotSettings,
  pilotTests,
  OUTSIDE_US,
  type PilotInterest,
} from "../../../research/pilot";
import { pilotPage as page } from "../../../research/report";
import { Button } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { Chips } from "../../ui/Chips";
import { Form } from "../../ui/Form";
import { Honeypot } from "../../ui/Honeypot";
import { Segmented } from "../../ui/Segmented";
import { SelectField } from "../../ui/SelectField";
import { TextField } from "../../ui/TextField";
import { RootLink } from "../../nav/root";
import { joinPilotList } from "./api";
import { ResearchFrame } from "./ResearchFrame";
import styles from "./Pilot.module.css";

/** `/research/pilot`: the pilot study's interest list. One centred column,
 * as a sign-up page is: the title, what taking part means, then the form, one
 * field to a row. The words live in `src/research/report.ts` (`pilotPage`),
 * from RR-3. */
export function PilotScreen() {
  return (
    <ResearchFrame>
      <div className={styles.column}>
        <div className={styles.intro}>
          <h1 className={styles.title}>{page.title}</h1>
          <p className={styles.lede}>{page.lede}</p>
          <p className={styles.status}>
            {page.status} <Link to="/research">The research behind AMP</Link>
          </p>
        </div>

        <section className={styles.section} aria-labelledby="pilot-exchange">
          <h2 id="pilot-exchange">{page.exchange.heading}</h2>
          {[page.exchange.receive, page.exchange.provide].map((side) => (
            <div key={side.label} className={styles.side}>
              <h3>{side.label}</h3>
              <ul>
                {side.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
          <p>
            {page.exchange.now} <RootLink>Start AMP free</RootLink>
          </p>
        </section>

        <section className={styles.card} aria-labelledby="pilot-join">
          <h2 id="pilot-join">{page.form.heading}</h2>
          <PilotForm />
          <p className={styles.privacy}>{page.form.privacy}</p>
        </section>
      </div>
    </ResearchFrame>
  );
}

type Field =
  "role" | "email" | "learners" | "bands" | "setting" | "place" | "name";
type Role = keyof typeof pilotRoles;
type Band = keyof typeof pilotBands;
type Test = keyof typeof pilotTests;
const options = <T extends string>(choices: Record<T, string>) =>
  (Object.keys(choices) as T[]).map((value) => ({
    value,
    label: choices[value],
  }));
/** The states by name, with outside the US last. */
const places = Object.entries(pilotPlaces)
  .filter(([code]) => code !== OUTSIDE_US)
  .sort(([, a], [, b]) => a.localeCompare(b))
  .concat([[OUTSIDE_US, pilotPlaces[OUTSIDE_US]!]]);

/** The list's form. Sent, the thanks takes its place and comes into view:
 * the form is long, and the thanks belongs where the person is looking. */
function PilotForm() {
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [learners, setLearners] = useState("");
  const [bands, setBands] = useState<Band[]>([]);
  const [setting, setSetting] = useState("");
  const [place, setPlace] = useState("");
  const [tests, setTests] = useState<Test[]>([]);
  const [source, setSource] = useState("");
  const [news, setNews] = useState(false);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const thanks = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sent) return;
    thanks.current?.focus({ preventScroll: true });
    thanks.current?.scrollIntoView({ block: "center" });
  }, [sent]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const count = Number(learners.replace(/[,\s]/g, ""));
    const next: Partial<Record<Field, string>> = {};
    if (!role) next.role = "Choose one.";
    // The server's own rule, so an address it would refuse is marked here.
    if (!pilotInterestSchema.shape.email.safeParse(email.trim()).success)
      next.email = "Enter an email address we can write to.";
    if (!(Number.isInteger(count) && count > 0 && count <= 100_000))
      next.learners = "Enter a number, like 2.";
    if (!bands.length) next.bands = "Choose at least one.";
    if (!setting) next.setting = "Choose one.";
    if (!place) next.place = "Choose one.";
    setErrors(next);
    setFailure("");
    if (Object.keys(next).length || !role) return;
    setBusy(true);
    const signup: PilotInterest = {
      role,
      email: email.trim(),
      learners: count,
      bands,
      setting: setting as PilotInterest["setting"],
      place,
      tests,
      news,
      ...(name.trim() ? { name: name.trim() } : {}),
      ...(source.trim() ? { source: source.trim() } : {}),
      ...(website ? { website } : {}),
    };
    try {
      await joinPilotList(signup);
      setSent(email.trim());
    } catch (error) {
      console.error("The pilot sign-up didn’t send", error);
      setFailure((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const learnersLabel =
    role === "educator" ? "How many students" : "How many children";
  if (sent)
    return (
      <div ref={thanks} className={styles.sent} role="status" tabIndex={-1}>
        <h3>{page.form.thanks}</h3>
        <p>
          {page.form.next} <strong>{sent}</strong>.
        </p>
      </div>
    );
  return (
    <Form className={styles.form} onSubmit={(event) => void submit(event)}>
      <Group label="I am" error={errors.role}>
        <Segmented
          label="I am"
          options={options(pilotRoles)}
          value={role}
          onChange={setRole}
        />
      </Group>
      <TextField
        label="Your email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        maxLength={254}
        error={errors.email}
      />
      <TextField
        label="Your name (optional)"
        autoComplete="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={100}
      />
      <TextField
        label={learnersLabel}
        inputMode="numeric"
        placeholder="e.g. 2"
        value={learners}
        onChange={(event) => setLearners(event.target.value)}
        maxLength={7}
        error={errors.learners}
      />
      <Group label="Grades" error={errors.bands}>
        <Chips
          label="Grades"
          options={options(pilotBands)}
          value={bands}
          onChange={setBands}
        />
      </Group>
      <Choice
        label="Where they learn math"
        value={setting}
        onValueChange={setSetting}
        error={errors.setting}
      >
        {options(pilotSettings).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Choice>
      <Choice
        label="State"
        value={place}
        onValueChange={setPlace}
        error={errors.place}
      >
        {places.map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </Choice>
      <Group label="Math tests they already take (optional)">
        <Chips
          label="Math tests they already take"
          options={options(pilotTests)}
          value={tests}
          onChange={setTests}
        />
      </Group>
      <TextField
        label="How you heard about the study (optional)"
        value={source}
        onChange={(event) => setSource(event.target.value)}
        maxLength={300}
      />
      <Checkbox checked={news} onChange={setNews}>
        Also send me AMP’s occasional news.
      </Checkbox>
      {/* Left empty by people; a form filler that completes it is thanked
          and nothing is saved. */}
      <Honeypot value={website} onChange={setWebsite} />
      <div className={styles.send}>
        <Button type="submit" variant="primary" aria-busy={busy || undefined}>
          Join the list
        </Button>
        <p className={styles.failure} role="alert">
          {failure}
        </p>
      </div>
    </Form>
  );
}

/** A labelled group of chips or segments, with its message line reserved so
 * a message moves nothing below it. */
function Group({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={styles.group}>
      <span className={styles.groupLabel} aria-hidden="true">
        {label}
      </span>
      {children}
      <span className={styles.groupError} role={error ? "alert" : undefined}>
        {error}
      </span>
    </div>
  );
}

/** A picker with its message line, like a text field's. */
function Choice({
  label,
  value,
  onValueChange,
  error,
  children,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={styles.group}>
      <SelectField
        label={label}
        value={value}
        onValueChange={onValueChange}
        hideEmpty
      >
        <option value="">Choose</option>
        {children}
      </SelectField>
      <span className={styles.groupError} role={error ? "alert" : undefined}>
        {error}
      </span>
    </div>
  );
}
