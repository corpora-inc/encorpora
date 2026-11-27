# Research export

AMP's research export writes a de-identified extract of a study's participants'
practice data, encrypted to the study's researchers, into the private research
bucket. It is an operator job with no HTTP route. It runs only as its own
Kubernetes Job from the `api` image, never in an API pod. The code is
`src/research/`.

## Who is in an extract

`amp_research_participants` (migration 0156) holds one row per study and learner:
the study code, the learner, the household account, `enrolled_at`,
`withdrawn_at` and a nullable `consent_ref` to the permission record. The
consent flow writes it with `src/research/participants.ts`:

- `enrollParticipant(db, { study, learnerId, consentRef? })`: enrols, from now
  (the moment permission is recorded; there is no backdating). The household
  comes from the learner's row. Enrolling again while enrolled changes
  nothing. Enrolling after a withdrawal starts a new enrolment, so weeks count
  from the new date.
- `withdrawParticipant(db, { study, learnerId })`: withdraws, now. The first
  withdrawal date is kept.

An extract includes a learner who is enrolled in that study at the time of the
snapshot, has not withdrawn, and is not deleted. It includes their records from
enrolment on. A withdrawn learner is in no later extract (the study's consent
lets a participant withdraw; 45 CFR 46.116(b)(8) where the Common Rule applies).
Rows go with the learner by cascade, like their other records.

## What an extract contains

One object per run, `<study>/<study>-<UTC time>.zip.age`: an age-encrypted ZIP.

| File | One row is |
| --- | --- |
| `participants.csv` | a participant: study learner ID, study family ID, current week |
| `answers.csv` | a problem served: sequence, week, skill, problem type, why it was chosen, outcome (answered, skipped, unanswered), correctness, parts, assisted, independent, help used (hint, lesson, video, worked example, adult), app or paper, evidence weight, seconds to answer, the learner's level at the end of the previous day |
| `workbooks.csv` | a workbook made: week, number, length, sections, items, lesson, lean, focus skill, working level |
| `adult_checkins.csv` | a parent or teacher check-in: week, role, kind (view, assign, score) |
| `weekly_activity.csv` | a participant-week from 1 to now, zeros included: active seconds in total and by surface, answers, right, independent, and help opened by kind (time and help are per local day, so they start the first whole day after enrolment) |
| `skills.csv` | a skill in the catalog: title, strand, area, grade |
| `codebook.md`, `codebook.json` | the data dictionary: every file, column, type, meaning and value set |
| `manifest.json` | study, extract version, participant count, and each file's rows, bytes and SHA-256 |

`src/research/codebook.ts` defines every column once: the CSV headers and the
codebook both come from it, and the export refuses a query column the codebook
doesn't declare.

What no file contains: names, email addresses, account, learner or problem ids,
network addresses, birth dates or years, anything a person typed (answers'
text, notes), workbook codes, or calendar dates. The manifest has no date and
every ZIP entry has the same fixed time, so nothing dates the weeks. Time is the instructional week:
week 1 is the participant's first seven local days from enrolment. Participants
are keyed by study ID only (the de-identification FERPA asks of school records,
34 CFR 99.31(b)(1), and what the study's data security plan promises).

### Study IDs

`L-7K2M-9QXA-3TJD` for a learner, `F-…` for a household. Each is HMAC-SHA256,
under the study-ID key, of the study code, the kind and the AMP id, written as
60 bits of Crockford base32. An ID is the same in every extract of a study,
different in every other study, and can't be reversed or recomputed without the
key. The key is a Secret Manager secret (`AMP_RESEARCH_ID_KEY`, at least 32
bytes). Without it, or with any other configuration missing, the job stops
before it reads anything. Rotating the key changes every ID, so keep it for a
study's lifetime.

### How it is read and written

One connection holds one `REPEATABLE READ READ ONLY` snapshot. Each file is a
cursor read in batches of 1,000 rows. Each batch is written into the ZIP,
encrypted and uploaded before the next is fetched, so memory stays at about a
batch whatever the study's size. The job used about 180 MB resident in total,
most of it the curriculum catalog. No plaintext is written to disk. The
ciphertext goes to Cloud Storage as a resumable upload that may only create the
object (`ifGenerationMatch: 0`). A failed run leaves no object.

Encryption is [age](https://age-encryption.org/v1) (`age-encryption` on npm),
to every researcher key configured, so the bucket holds ciphertext only (COPPA's
security requirement, 16 CFR 312.8, and the study's data security plan).

## Running it

```sh
node src/research/export-cli.mjs --study rr3
```

The Job runs this from the `api` image. The server build bundles the command
(`scripts/build-server.ts`), so it runs on plain node. Run it on demand as a
Kubernetes Job with bounded resources, never a CronJob, and never in an API
pod. It needs:

| Setting | Value |
| --- | --- |
| `AMP_DATABASE_URL` | the AMP database, as the other jobs use it |
| `AMP_RESEARCH_ID_KEY` | the study-ID key, from Secret Manager |
| `AMP_RESEARCH_RECIPIENTS` | the researchers' age public keys, separated by new lines, spaces or commas; `#` starts a comment |
| `AMP_RESEARCH_BUCKET` | the research bucket's name |

Cloud Storage access is the Job's Google service account through Workload
Identity, with no key file. The command prints one line of JSON: destination,
participant and row counts, and the ciphertext's size and SHA-256. It prints no
study IDs and no rows.

For development, `npm run research:export -- --study rr3 --output <file>`
writes the encrypted extract to a new file instead of the bucket. Never point
a development run at production data.

## Adding a researcher

1. The researcher makes a key pair on their own machine and keeps the private
   key there: `age-keygen -o rr3-key.txt` (or `age-keygen -pq` for a
   post-quantum key). They send only the public key, the `age1…` line it prints.
2. Add that line, with a `#` comment naming the researcher, to the Job's
   `AMP_RESEARCH_RECIPIENTS` configuration in the deployment repository.
3. The next run encrypts to every listed key. Removing a key affects later
   extracts only; one already downloaded stays readable with it.

Bucket read access for that researcher is separate (the deployment repository's
research bucket IAM).

## Reading an extract

```sh
age -d -i rr3-key.txt rr3-20261127T140501Z.zip.age > rr3.zip
unzip rr3.zip -d rr3
cd rr3 && shasum -a 256 *.csv codebook.*   # compare with manifest.json
```
