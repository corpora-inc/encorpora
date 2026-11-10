import { useState, type FormEvent } from "react";
import { Button } from "../../ui/Button";
import { TextArea, TextField } from "../../ui/TextField";
import { sendInquiry } from "./api";
import styles from "./TalkToUs.module.css";

type Errors = Partial<Record<"name" | "email" | "school" | "students", string>>;
const MESSAGE_LIMIT = 4000;

/** "Talk to us" on `/schools`: a few lines to the company mailbox, answered by
 * a person. Sent, the thanks takes the form's place without moving the page;
 * the footer below has the address for anyone who'd rather write. */
export function TalkToUs() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState("");
  const [students, setStudents] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const count = students.trim()
      ? Number(students.replace(/[,\s]/g, ""))
      : null;
    const next: Errors = {};
    if (!name.trim()) next.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Enter an email address we can answer.";
    if (!school.trim()) next.school = "Enter your school’s name.";
    if (count !== null && !(Number.isInteger(count) && count > 0))
      next.students = "Enter a number, like 120.";
    setErrors(next);
    setFailure("");
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await sendInquiry({
        name: name.trim(),
        email: email.trim(),
        school: school.trim(),
        ...(count ? { students: count } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
        ...(website ? { website } : {}),
      });
      setSent(email.trim());
    } catch (error) {
      console.error("The school inquiry didn’t send", error);
      setFailure((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.talk}>
      <div className={styles.stage}>
        <form
          className={styles.form}
          onSubmit={(event) => void submit(event)}
          noValidate
          aria-hidden={sent ? true : undefined}
          inert={sent ? true : undefined}
          data-hidden={sent ? true : undefined}
        >
          <div className={styles.pair}>
            <TextField
              label="Your name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              error={errors.name}
            />
            <TextField
              label="Your email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              error={errors.email}
            />
          </div>
          <div className={styles.pair}>
            <TextField
              label="School or organization"
              autoComplete="organization"
              value={school}
              onChange={(event) => setSchool(event.target.value)}
              maxLength={200}
              error={errors.school}
            />
            <TextField
              label="Approximate number of students"
              inputMode="numeric"
              placeholder="e.g. 120"
              value={students}
              onChange={(event) => setStudents(event.target.value)}
              maxLength={9}
              error={errors.students}
            />
          </div>
          <TextArea
            label="What you’d like to talk about (optional)"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={MESSAGE_LIMIT}
            rows={4}
          />
          {/* Left empty by people; a form filler that completes it is
              thanked and nothing is sent. */}
          <input
            className={styles.trap}
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
          <div className={styles.send}>
            <Button
              type="submit"
              variant="primary"
              aria-busy={busy || undefined}
            >
              Send
            </Button>
            <p className={styles.failure} role="alert">
              {failure}
            </p>
          </div>
        </form>
        {sent && (
          <div className={styles.sent} role="status">
            <h3>Thank you.</h3>
            <p>
              We’ll write to you at <strong>{sent}</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
