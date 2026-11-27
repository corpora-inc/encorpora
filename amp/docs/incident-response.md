# Incident response

What to do when someone may have read, changed or taken AMP data they should not have, or holds a credential that could. One person runs it: **the incident lead**, the founder, Corpora's only employee today. Contacts, the cloud project id, the cluster context and where evidence is kept are in the private runbook in `corpora-inc/infra-private` (`operations/AMP_INCIDENT_ACCESS.md`). Nothing account-specific goes in this repository, its issues or its logs.

This procedure, its yearly test and the records in [`incident-exercises/`](incident-exercises/) are part of the written security program COPPA requires (16 CFR 312.8(b): a designated coordinator, regular testing of safeguards, a yearly review).

Keep a log from the first minute: UTC time, what was seen, what was run, by whom. It is the record every notice below draws on.

## 1. Detect

What exists today:

| Source | Covers |
| --- | --- |
| Mail to support@corpora.inc | The notice address in the student data agreement (§5, §7, §9). Schools, parents and researchers report here. |
| `deploy-corpora-amp` (free2z/tuzi) | Smoke checks after every deploy; a failed release rolls back by itself. Failed runs show in Actions. |
| `AMP production check` workflow | Loads `/` and `/sign-up` in real browsers after each release; a failure opens or updates one issue. |
| Cloud Monitoring | The cluster's container OOM-kill alert, mailed to the owner. |
| `hygiene` gate | gitleaks on every PR to this repository. |

Places to look once something is suspected (none of them alert):

- Cloud Audit Logs. Admin Activity, which includes `cloudsql.instances.connect` with the calling identity, kept 400 days. Secret Manager reads (Data Access), kept 30 days.
- GKE audit log (Admin Activity): `kubectl exec` and every change in `corpora-amp`.
- AMP's request log: method, path with secrets redacted, client address and status, kept 30 days.
- `amp_school_events`: an append-only history of the changes each school user made. It does not record reads.

## 2. Triage

| Level | Means | Do |
| --- | --- | --- |
| **1 · data** | Personal data of a student, child, parent or teacher was or may have been read, changed or taken without authorization. Or a credential that can read it is out: the database URL, `AMP_ACCOUNTS_SECRET`, AMP's runtime or deployer identity, a cloud owner's account, a school admin's or teacher's account. | All of sections 3 to 7, now. |
| **2 · credential** | A secret leaked that reaches no personal data, such as `AMP_RENDER_TOKEN`. | Rotate it (section 3) and log it. No notices. |
| **3 · outage** | Something broke and nothing was exposed. | Fix forward ([deployment](deployment.md#releases)). Not this procedure. |

**Confirmed** means the incident lead has evidence that unauthorized access to student data happened, not only that it was possible. The school's 72-hour clock (section 6) starts at that moment. Write the time in the log.

## 3. Contain

Set up once per terminal. The tabletop of [2026-11-27](incident-exercises/2026-11-27-tabletop.md) ran these commands in read-only or server-side dry-run form, or checked their flags; it lists which.

```sh
export PROJECT=<cloud project id, private runbook>
export NS=corpora-amp
export E="$HOME/incidents/$(date -u +%F)"   # evidence and working files, outside every repository
umask 077; mkdir -p "$E"
kubectl config use-context <cluster context, private runbook>
```

### Rotate a secret in the API's env file

`corpora-amp-prod-env` in Secret Manager holds every API secret. A deploy copies its latest version into a new immutable Kubernetes Secret and rolls the pods.

```sh
gcloud secrets versions access latest --secret=corpora-amp-prod-env --project=$PROJECT > "$E/env"
# change only the leaked line, then:
gcloud secrets versions add corpora-amp-prod-env --project=$PROJECT --data-file="$E/env"
gh workflow run deploy-corpora-amp.yml -R free2z/tuzi -f environment=prod
```

The deploy needs the workflow enabled and the deployer identity working; re-enable them first if you turned them off. If the deploy goes red it rolls back to the previous release, and with it the previous Secret: fix and deploy again. Delete `$E/env` once the deploy is green. Check with `gcloud secrets versions list corpora-amp-prod-env --project=$PROJECT --limit=3` and `curl -s https://amp.corpora.inc/api/v1/health`.

### End sessions

`npm run sessions:revoke` ends AMP sessions in bulk ([#2555](https://github.com/corpora-inc/encorpora/issues/2555)): `--account 'amp|<user id>'`, `--org <org id>` (the org and every org under it) or `--all`. Account sessions and unused password-reset links are deleted. Student and provider (Clever) sessions are marked revoked, as **Sign out everywhere** does. Each holder's next request gets 401, and an open live-class stream closes within 95 seconds and cannot reopen. An adult in an org is an account: `--org` signs them out everywhere, not only there. `--account` on a parent also ends their children's student sessions. Nobody is blocked: everyone signs in again as usual.

It runs as a one-off Job from the current `api` image, with the configuration the daily privacy job already has. It never runs inside a serving pod. Run it before scaling `amp-sql-proxy` down, since it needs the database. `--dry-run` counts the same rows in a read-only transaction and changes nothing. The output is one JSON line of counts. Every real run also writes one row to `amp_operator_events`, and for `--org` one line in that school's activity history.

```sh
revoke() {  # revoke --dry-run --all | revoke --org <org id> | revoke --account 'amp|<user id>'
  job=amp-revoke-sessions-$(date -u +%Y%m%d%H%M%S)
  kubectl -n $NS create job "$job" --from=cronjob/amp-privacy-retention --dry-run=client -o json |
    jq --argjson args "$(printf '%s\n' "$@" | jq -R . | jq -cs .)" \
      '.spec.backoffLimit = 0 | .spec.template.spec.containers[0].command = ["node_modules/.bin/tsx", "scripts/revoke-sessions.ts"] + $args' |
    kubectl -n $NS create -f - || return
  # Done when it succeeded or failed; either way its output is the answer.
  until kubectl -n $NS get job "$job" -o jsonpath='{.status.succeeded}{.status.failed}' | grep -q 1; do sleep 2; done
  kubectl -n $NS logs "job/$job" | tee -a "$E/revoke-sessions.log"
}
revoke --dry-run --all   # counts only
revoke --all
```

A wrong id fails at once with its reason and writes nothing. A rerun is safe: it ends what is left, which may be nothing.

### Rotate `AMP_ACCOUNTS_SECRET`

The secret is versioned (Better Auth `secrets`). The current one signs cookies and links and encrypts new authenticator secrets and backup codes, tagged with its version. Retired versions only decrypt what they encrypted, so a parent's authenticator keeps working across a rotation. In the env file (rotate as above):

1. Append the current secret to `AMP_ACCOUNTS_PREVIOUS_SECRETS` under its version: `1:<current value>` the first time (the version is `AMP_ACCOUNTS_SECRET_VERSION`, default `1`). Entries are comma-separated.
2. Set `AMP_ACCOUNTS_SECRET` to a new value (`openssl rand -hex 32`) and `AMP_ACCOUNTS_SECRET_VERSION` to the next number.
3. Deploy. Cookies signed with the old secret stop working. A session used by bearer token is not tied to the secret, so to sign everyone out, also `revoke --all`.

Keep a retired version while authenticators enrolled under it remain. With version 2 current, `SELECT count(*) FROM amp_auth_two_factors WHERE secret NOT LIKE '$ba$2$%'` counts those enrolled before it. Values stored before versioning carry no tag; version 1 decrypts them. When the database leaked together with the secret, the authenticator secrets are exposed as well: ask the parents who have one to set it up again in Security.

| Exposed | Contain |
| --- | --- |
| Database URL (`amp_prod` password) | Treat the database as read (section 5). <br>1. `gcloud sql users set-password amp_prod --instance=tenants --project=$PROJECT --prompt-for-password`. Also add a version to `corpora-amp-prod-db-password`. <br>2. Put the new password in `AMP_DATABASE_URL` and rotate as above. AMP fails new connections from the password change until the new pods are ready. <br>3. A password change does not end sessions already open. From a new pod, end the older ones (the tabletop ran its `count(*)` form): `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = current_user AND pid <> pg_backend_pid() AND backend_start < '<rotation time>';` <br>4. Account session tokens are stored as their SHA-256 (migration 0158), password-reset links hashed, and student and provider sessions, cards and pictures hashed, so a copy of the database holds no session or link that works, except a session an older release stored as issued that nobody has used since. Count those: `SELECT count(*) FROM amp_auth_sessions WHERE token NOT LIKE 'sha256:%' AND "expiresAt" > now()`. If it is not 0, `revoke --all`. If the env file leaked too, see `AMP_ACCOUNTS_SECRET` below. <br>5. Provider access, refresh and ID tokens are no longer stored (`amp_auth_accounts`, migration 0157): AMP uses a provider only to sign in. If the env file leaked as well, rotate the provider client secrets. |
| Provider secret: Stripe, Resend, Google, Microsoft, GitHub, Apple, Clever | Revoke or roll it at the provider first, then rotate as above. |
| `AMP_ACCOUNTS_SECRET` | Rotate it to a new version ([Rotate `AMP_ACCOUNTS_SECRET`](#rotate-amp_accounts_secret)), then `revoke --all` to sign every account out. Authenticators keep working. Links and flows it signs stop working: invitations, approvals, adoption and buyer links (unless `AMP_LINK_SECRET` is set, then rotate that too), and school sign-ins in progress. |
| `AMP_CONSENT_SECRET_BASE64` | Parent addresses waiting for consent mail are encrypted with it, including the confirmatory notice email-plus consent owes (16 CFR 312.5(b)(2)(vi)). Rotate only when nothing is queued: `SELECT stage, count(*) FROM amp_consent_outbox WHERE accepted_at IS NULL AND rejected_at IS NULL AND stopped_at IS NULL GROUP BY 1` returns no rows. Otherwise let the worker send the queue first, or record the parents it could not reach. |
| `AMP_RENDER_TOKEN` | Rotate as above. See "Rotate the token" in the tenant README in free2z/tuzi. |
| Runtime identity `corpora-amp-prod` | It has no user-managed keys; it authenticates through Workload Identity. Check: `gcloud iam service-accounts keys list --iam-account=corpora-amp-prod@$PROJECT.iam.gserviceaccount.com --managed-by=user --project=$PROJECT`. If a key appears: `gcloud iam service-accounts keys disable <key id> --iam-account=…`. To cut the identity itself: `gcloud iam service-accounts disable corpora-amp-prod@$PROJECT.iam.gserviceaccount.com --project=$PROJECT`. This takes AMP's database away. Undo with `enable`. |
| Deployer `corpora-amp-deployer` (GitHub OIDC) | Stop deploys with `gh workflow disable deploy-corpora-amp.yml -R free2z/tuzi`, then `gcloud iam service-accounts disable corpora-amp-deployer@$PROJECT.iam.gserviceaccount.com --project=$PROJECT`. |
| One parent, teacher or admin account | `revoke --account 'amp\|<user id>'` ends its sessions, school sign-ins and reset links now, and a parent's children's student sessions. The owner then resets the password (**Reset your password** on the sign-in screen), which also revokes all of that account's sessions. In Security, the owner removes every passkey and linked login they do not recognise; a reset leaves those in place. Ending an admin's or teacher's role in the school stops their access on the next request. |
| One school or district | `revoke --org <org id>`: the sessions of everyone with a current role or enrollment there or in any school under it. |
| One student's card or session | On the class roster the teacher uses **Print a new card** (the old card stops working) **and** **Sign out everywhere** (ends sessions the card already opened); **Reset pictures** for picture sign-in. In a family: **Download a new card** and **Sign out everywhere** in Devices. |
| All sessions at once | `revoke --all`. AMP stays online; to stop new sign-ins as well, take AMP offline after it. |

### Take AMP offline

Stop the deploy poll first, or the next release undoes this. Record what is suspended now, so restoring does not turn on a job that was off.

```sh
gh workflow disable deploy-corpora-amp.yml -R free2z/tuzi &&
kubectl -n $NS get cronjob -o custom-columns=NAME:.metadata.name,SUSPEND:.spec.suspend > "$E/cronjobs-before.txt" &&
kubectl -n $NS scale deployment/amp-api --replicas=0        # no API; the web shell still loads
for j in $(kubectl -n $NS get cronjob -o name); do kubectl -n $NS patch $j -p '{"spec":{"suspend":true}}'; done
kubectl -n $NS scale deployment/amp-sql-proxy --replicas=0  # also cuts every in-cluster database connection
```

Suspending a CronJob does not stop a Job already running; check `kubectl -n $NS get jobs` before scaling the proxy down. The API's autoscaler does not scale up a Deployment set to zero. To restore, scale `amp-sql-proxy` and `amp-api` back to 2, un-suspend only the jobs that `cronjobs-before.txt` lists as `false`, then run `gh workflow enable deploy-corpora-amp.yml -R free2z/tuzi`.

## 4. Preserve evidence

Do this before cleaning anything up. Save every file to `$E`, never to a repository. Container logs and Secret Manager reads are kept for 30 days and the database's point-in-time window is 7 days, so do it on day one.

```sh
SINCE=<RFC 3339 start of the suspect window>
gcloud logging read "logName=\"projects/$PROJECT/logs/cloudaudit.googleapis.com%2Factivity\" AND timestamp>=\"$SINCE\"" --project=$PROJECT --format=json > $E/admin-activity.json
gcloud logging read "protoPayload.serviceName=\"secretmanager.googleapis.com\" AND protoPayload.resourceName:\"secrets/corpora-amp-prod\" AND timestamp>=\"$SINCE\"" --project=$PROJECT --format=json > $E/secret-reads.json
gcloud logging read "resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"$NS\" AND timestamp>=\"$SINCE\"" --project=$PROJECT --format=json > $E/amp-containers.json
kubectl -n $NS get deploy,rs,pods,cronjob,jobs -o wide > $E/cluster-state.txt
```

Admin activity includes every `cloudsql.instances.connect` with its identity, and every `kubectl exec` into the namespace.

Database state at a moment: check the window with `gcloud sql instances get-latest-recovery-time tenants --project=$PROJECT`, then clone:

```sh
gcloud sql instances clone tenants tenants-ir-$(date -u +%Y%m%d) --point-in-time='<RFC 3339, before containment>' --project=$PROJECT
```

The clone holds a full copy of production data. Query it, never prod, for forensics. Delete it with `gcloud sql instances delete` once notices are done, since the retention promises in the student data agreement (§8) cover it too.

## 5. Assess whose data was touched

Start from what the credential or account could reach. Then narrow with logs. If the database has no statement log covering the window (the private runbook says what it records), a misused database credential means everything `amp_prod` can read was read.

The query below runs inside an API pod in a read-only transaction and prints counts only. Save it as `ir-scope.js`.

```sh
kubectl -n $NS exec -i deployment/amp-api -c api -- env IR_ACCOUNT='amp|<user id>' node - < ir-scope.js
```

```js
// Read-only. Counts only. IR_ACCOUNT=amp|<user id> adds one account's reach.
const { Client } = require("/app/node_modules/pg");
const account = process.env.IR_ACCOUNT;
const all = {
  accounts: `SELECT count(*)::int AS adult_accounts FROM amp_auth_users`,
  learners: `SELECT CASE WHEN account_id LIKE 'school:%' THEN 'school'
                 WHEN account_id LIKE 'trial:%' THEN 'trial' ELSE 'family' END AS kind,
                 count(*)::int FROM amp_learners GROUP BY 1 ORDER BY 1`,
  org_people: `SELECT o.kind, o.demo, count(DISTINCT o.id)::int AS orgs, count(p.id)::int AS people
                 FROM amp_orgs o LEFT JOIN amp_people p ON p.tenant_id = o.id AND p.deleted_at IS NULL
                GROUP BY 1,2 ORDER BY 1,2`,
  school_agreements: `SELECT
      (SELECT count(*) FROM amp_data_agreements a JOIN amp_orgs o ON o.id = a.org_id
        WHERE NOT o.demo AND a.ended_at IS NULL)::int AS org_agreements,
      (SELECT count(*) FROM amp_class_authorizations a JOIN amp_classes c ON c.id = a.class_id
        JOIN amp_orgs o ON o.id = c.org_id WHERE NOT o.demo AND a.ended_at IS NULL)::int AS class_authorizations`,
  state_programs: `SELECT program, count(*)::int AS accounts FROM amp_parent_followups GROUP BY 1 ORDER BY 2 DESC`,
  live_sessions: `SELECT
      (SELECT count(*) FROM amp_auth_sessions WHERE "expiresAt" > now())::int AS account,
      (SELECT count(*) FROM amp_student_sessions WHERE revoked_at IS NULL AND expires_at > now())::int AS student,
      (SELECT count(*) FROM amp_provider_sessions WHERE revoked_at IS NULL AND expires_at > now())::int AS provider`,
  db_connections: `SELECT usename, application_name, count(*)::int FROM pg_stat_activity
                    WHERE datname = current_database() GROUP BY 1,2 ORDER BY 3 DESC`,
};
const one = {
  reach: `WITH me AS (SELECT id FROM amp_people WHERE account_id = $1 AND deleted_at IS NULL),
      taught AS (SELECT DISTINCT e.class_id FROM amp_enrollments e JOIN me ON me.id = e.person_id
                  WHERE e.role IN ('teacher','aide') AND (e.end_on IS NULL OR e.end_on > current_date)),
      orgs AS (SELECT DISTINCT o.id FROM amp_org_roles r JOIN me ON me.id = r.person_id
                JOIN amp_orgs o ON r.org_id = ANY(o.path)
               WHERE r.role IN ('admin','viewer') AND (r.end_on IS NULL OR r.end_on > current_date))
    SELECT (SELECT count(*) FROM amp_learners WHERE account_id = $1)::int AS own_learners,
           (SELECT count(*) FROM taught)::int AS classes_taught,
           (SELECT count(DISTINCT e.person_id) FROM amp_enrollments e JOIN taught USING (class_id)
             WHERE e.role = 'student')::int AS students_taught,
           (SELECT count(*) FROM orgs)::int AS orgs_administered,
           (SELECT count(DISTINCT x.person_id) FROM (
              SELECT r.person_id FROM amp_org_roles r JOIN orgs ON orgs.id = r.org_id
              UNION SELECT e.person_id FROM amp_enrollments e JOIN amp_classes cl ON cl.id = e.class_id
                JOIN orgs ON orgs.id = cl.org_id) x
              JOIN amp_people p ON p.id = x.person_id WHERE p.deleted_at IS NULL)::int AS people_administered`,
  sessions: `SELECT (SELECT count(*) FROM amp_auth_sessions
                      WHERE 'amp|' || "userId" = $1 AND "expiresAt" > now())::int AS account_sessions`,
  actions_30d: `SELECT e.action, count(*)::int FROM amp_school_events e
                  JOIN amp_people p ON p.id = e.actor_person_id
                 WHERE p.account_id = $1 AND e."at" > now() - interval '30 days'
                 GROUP BY 1 ORDER BY 2 DESC`,
};
(async () => {
  const c = new Client({ connectionString: process.env.AMP_DATABASE_URL, application_name: "ir-readonly" });
  await c.connect();
  try {
    await c.query("BEGIN READ ONLY");
    await c.query("SET LOCAL statement_timeout = '15s'");
    for (const [k, sql] of Object.entries(all)) console.log(k, JSON.stringify((await c.query(sql)).rows));
    if (account) for (const [k, sql] of Object.entries(one))
      console.log(k, JSON.stringify((await c.query(sql, [account])).rows));
  } finally { await c.query("ROLLBACK"); await c.end(); }
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
```

Demo orgs (`demo = true`) are synthetic. Leave them out of every count you report. `kind = 'family'` orgs are families teaching their own children, not schools.

**A taken-over account.** Its reach is the `reach` row. Use the request log to see what it actually did. The log has no user id, so match the account's session addresses (`amp_auth_sessions."ipAddress"`) against `jsonPayload.req.remoteAddress`, and read its `amp_school_events`.

**Who to tell.** Only during an incident, print the notice list from the clone, or from prod in a read-only transaction. It includes ended agreements: the agreement lasts as long as Corpora holds the school's data (§9). For a signer shown as `Removed`, write to the class's current teachers or the school's admins.

```sql
SELECT 'class' AS kind, o.name AS school, a.signer_name, u.email, a.ended_at
  FROM amp_class_authorizations a JOIN amp_classes c ON c.id = a.class_id JOIN amp_orgs o ON o.id = c.org_id
  LEFT JOIN amp_auth_users u ON 'amp|' || u.id = a.account_id
 WHERE NOT o.demo
UNION ALL
SELECT 'school', o.name, a.signer_name, coalesce(u.email, p.email), a.ended_at
  FROM amp_data_agreements a JOIN amp_orgs o ON o.id = a.org_id
  LEFT JOIN amp_people p ON p.id = a.signer_person_id
  LEFT JOIN amp_auth_users u ON 'amp|' || u.id = a.signer_account_id
 WHERE NOT o.demo;
```

**Which states.** AMP stores no home address. A family's state comes from its funding program (`amp_parent_followups.program`: `ar-efa`, `az-esa`, `nh-efa`), the billing address Stripe holds for paying customers, or the school's location.

**What kind of data.** AMP holds names, optional display names, emails, grade levels, school identifiers, class enrollments, answers and the skill evidence derived from them, hashed passwords, hashed student card and picture secrets, hashed password-reset links and account session tokens, passkey public keys, and Stripe customer references. It keeps no provider access or refresh tokens. Cards stay with Stripe. AMP holds no Social Security, driver's license, financial account, health or biometric data. Write down which fields were exposed, and whether any credential that works was among them. The state statutes in section 6 turn on that.

## 6. Notify

Only what a contract or law requires. Each row names its source.

| Who | When | Requirement |
| --- | --- | --- |
| Each school or teacher with a live agreement whose student data was involved (`amp_data_agreements`, `amp_class_authorizations`) | Without undue delay, and **within 72 hours of confirming**. Include what is known about the data and students affected and what is being done, then send updates. The school decides on any notice to families; help when asked. | AMP student data agreement §6. Where a state requires its own form, that form controls (§9). |
| Clever, when the student data came through Clever | Promptly, in time for Clever to meet its own notice duties; then cooperate. | Clever Additional Terms of Use for Developers §5 (effective 2025-11-21). |
| Residents, regulators, credit bureaus | Per the state table below, only when that state's definition of personal information is met. | State statutes below. |
| An IRB | Promptly, by that IRB's written procedures, when the incident involves data collected under a protocol it approved. The IRB or institution reports to OHRP. No AMP study had IRB approval on 2026-11-27, so this does not apply yet. | 45 CFR 46.108(a)(4)(i), an unanticipated problem involving risks to subjects or others. |
| The FTC | No notice. COPPA requires the security program, not a breach notice. After an incident, review and change the program and record it (section 7). | 16 CFR 312.8(b)(5). The FTC Health Breach Notification Rule (16 CFR 318) does not apply: AMP holds no health information. |

A law enforcement agency may ask for a delay so as not to compromise a criminal investigation. Georgia and Arkansas allow one (O.C.G.A. § 10-1-912(c); Ark. Code Ann. § 4-110-105(c)). Get the request in writing and notify once the agency clears it.

### State breach statutes

These are the states where AMP has users today: Georgia (Corpora's home state, and schools) and the three funding programs above. Statutes checked on 2026-11-27. For a resident of any other state, look up that state's statute before deciding.

| State | Statute | Triggers on | Individuals | Regulator and credit bureaus | When Corpora holds the data for someone else |
| --- | --- | --- | --- | --- | --- |
| Georgia | O.C.G.A. §§ 10-1-911, 10-1-912 | Name plus SSN, driver's license or state ID, a usable account or card number, or an account password, PIN or access code; unencrypted (§ 10-1-911(6)). | The duty in § 10-1-912(a) falls on "information brokers" (who sell personal information to third parties) and "data collectors" (government agencies). Corpora is neither. | Brokers and collectors only: credit bureaus when more than 10,000 Georgia residents are notified (§ 10-1-912(d)). | **Within 24 hours of discovery**, notify the agency (for example a Georgia public school or district) on whose behalf the data is kept (§ 10-1-912(b)). |
| Arkansas | Ark. Code Ann. §§ 4-110-103(7), 4-110-105 | Name plus SSN, driver's license or state ID, account or card number with its code, medical or biometric data; unencrypted. | In the most expedient time possible, without unreasonable delay (§ 4-110-105(a)). Not required if a reasonable investigation finds no reasonable likelihood of harm (§ 4-110-105(d)). Keep that written determination 5 years (§ 4-110-105(g)). | Attorney General when more than 1,000 individuals are notified, at the same time as the individuals or within 45 days of determining a reasonable likelihood of harm, whichever is first (§ 4-110-105(b)(2)). | Notify the owner immediately after discovery (§ 4-110-105(b)(1)). |
| Arizona | A.R.S. §§ 18-551(7), 18-552 | Name plus listed elements, **or a user name or email with a password or security answer that allows access to an online account** (§ 18-551(7)(a)(ii)); unencrypted and unredacted. | Within 45 days of determining the breach (§ 18-552(B)(1)). Not required if a reasonable investigation finds substantial economic loss not reasonably likely (§ 18-552(J)). | When more than 1,000 individuals are notified: the three largest nationwide credit bureaus, and the Attorney General and the director of the Arizona Department of Homeland Security in writing, within the same 45 days (§ 18-552(B)(2)). | Notify the owner as soon as practicable and cooperate (§ 18-552(C)). |
| New Hampshire | RSA 359-C:19, 359-C:20 | Name plus SSN, driver's license or government ID, or account or card number with the code that opens it; unencrypted, or encrypted and taken with its key (359-C:19). | As soon as possible, unless misuse is determined not reasonably likely. If it cannot be determined, notify (359-C:20, I(a)). | The Attorney General, with the expected notice date and the approximate number of New Hampshire residents (I(b)). Credit bureaus when more than 1,000 are notified (VI(a)). | Notify the owner immediately after discovery (I(c)). |

For AMP's data, the line most likely to apply is Arizona's online-account credentials: an email with a password or security answer. Passwords, session tokens and reset links are stored hashed, so a database copy exposes none that works, unless the count in section 3 (row 1, step 4) was not 0. A copy taken before migration 0158 did hold live session tokens, which are not passwords but open accounts until revoked (section 3). Record the reasoning for each state either way.

## 7. Recover and close

1. Restore service (section 3). Confirm `/api/v1/health` reports the expected commit and the deploy poll is enabled.
2. Delete evidence clones and local copies once notices and any regulator questions are done. Keep the incident log and the notices sent.
3. Write the record in [`incident-exercises/`](incident-exercises/) (`YYYY-MM-DD-incident.md`), redacted for this public repository: timeline, cause, what was exposed in counts, notices with their dates, and changes made. That record is the program review 16 CFR 312.8(b)(5) requires.
4. File each gap as an issue. Account-specific or exploitable detail goes to the private repositories.

Run a tabletop at least once a year and after any real incident (16 CFR 312.8(b)(4)–(5)). Each one gets a dated record in [`incident-exercises/`](incident-exercises/).
