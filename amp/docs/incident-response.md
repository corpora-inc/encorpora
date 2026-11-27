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
| Cloud Monitoring | One policy reaches AMP: the cluster-wide container OOM-kill alert, mailed to the owner. |
| `hygiene` gate | gitleaks on every PR to this repository. |

Places to look once something is suspected (none of them alert):

- Cloud Audit Logs. Admin Activity, which includes `cloudsql.instances.connect` with the calling identity, kept 400 days. Secret Manager reads (Data Access), kept 30 days.
- GKE audit log: `kubectl exec`, secret reads and other API calls in `corpora-amp`.
- AMP's request log: method, path with secrets redacted, client address and status, kept 30 days.
- `amp_school_events`: an append-only history of what each school user did.

## 2. Triage

| Level | Means | Do |
| --- | --- | --- |
| **1 · data** | Personal data of a student, child, parent or teacher was or may have been read, changed or taken without authorization. Or a credential that can read it is out: the database URL, `AMP_ACCOUNTS_SECRET`, AMP's runtime or deployer identity, a cloud owner's account, a school admin's or teacher's account. | All of sections 3 to 7, now. |
| **2 · credential** | A secret leaked that reaches no personal data, such as `AMP_RENDER_TOKEN`. | Rotate it (section 3) and log it. No notices. |
| **3 · outage** | Something broke and nothing was exposed. | Fix forward ([deployment](deployment.md#releases)). Not this procedure. |

**Confirmed** means the incident lead has evidence that unauthorized access to student data happened, not only that it was possible. The school's 72-hour clock (section 6) starts at that moment. Write the time in the log.

## 3. Contain

Set up once per terminal. Every command below was run in read-only or server-side dry-run form in the [2026-11-27 tabletop](incident-exercises/2026-11-27-tabletop.md).

```sh
export PROJECT=<cloud project id, private runbook>
export NS=corpora-amp
kubectl config use-context <cluster context, private runbook>
```

### Rotate a secret in the API's env file

`corpora-amp-prod-env` in Secret Manager holds every API secret. A deploy copies its latest version into a new immutable Kubernetes Secret and rolls the pods.

```sh
umask 077; mkdir -p ~/incidents/$(date -u +%F)   # outside every repository
gcloud secrets versions access latest --secret=corpora-amp-prod-env --project=$PROJECT > ~/incidents/$(date -u +%F)/env
# change only the leaked line, then:
gcloud secrets versions add corpora-amp-prod-env --project=$PROJECT --data-file=~/incidents/$(date -u +%F)/env
gh workflow run deploy-corpora-amp.yml -R free2z/tuzi -f environment=prod
```

Delete the local copy once the deploy is green. Check with `gcloud secrets versions list corpora-amp-prod-env --project=$PROJECT --limit=3` and `curl -s https://amp.corpora.inc/api/v1/health`.

| Exposed | Contain |
| --- | --- |
| Database URL (`amp_prod` password) | 1. `gcloud sql users set-password amp_prod --instance=tenants --project=$PROJECT --prompt-for-password`. Also add a version to `corpora-amp-prod-db-password`. <br>2. Put the new password in `AMP_DATABASE_URL` and rotate as above. AMP fails new connections from the password change until the new pods are ready. <br>3. A password change does not end sessions already open. From a new pod, end the older ones (the tabletop ran its `count(*)` form): `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = current_user AND pid <> pg_backend_pid() AND backend_start < '<rotation time>';` |
| Provider secret: Stripe, Resend, Google, Microsoft, GitHub, Apple, Clever | Revoke or roll it at the provider first, then rotate as above. |
| `AMP_ACCOUNTS_SECRET` | Rotate as above. Every account is signed out and outstanding invitation and buyer links stop working. Authenticator secrets are encrypted with it: until [#2555](https://github.com/corpora-inc/encorpora/issues/2555) lands, parents with an authenticator must enroll it again (none had one on 2026-11-27). |
| `AMP_CONSENT_SECRET_BASE64` | Rotate as above. Pending consent requests become unreadable and those parents ask again. |
| `AMP_RENDER_TOKEN` | Rotate as above. See "Rotate the token" in the tenant README in free2z/tuzi. |
| Runtime identity `corpora-amp-prod` | It has no user-managed keys; it authenticates through Workload Identity. Check: `gcloud iam service-accounts keys list --iam-account=corpora-amp-prod@$PROJECT.iam.gserviceaccount.com --managed-by=user --project=$PROJECT`. If a key appears: `gcloud iam service-accounts keys disable <key id> --iam-account=…`. To cut the identity itself: `gcloud iam service-accounts disable corpora-amp-prod@$PROJECT.iam.gserviceaccount.com --project=$PROJECT`. This takes AMP's database away. Undo with `enable`. |
| Deployer `corpora-amp-deployer` (GitHub OIDC) | Stop deploys with `gh workflow disable deploy-corpora-amp.yml -R free2z/tuzi`, then `gcloud iam service-accounts disable corpora-amp-deployer@$PROJECT.iam.gserviceaccount.com --project=$PROJECT`. |
| One parent, teacher or admin account | The owner resets the password (**Reset your password** on the sign-in screen). A reset revokes all of that account's sessions. Ending an admin's or teacher's role in the school stops their access on the next request. |
| One student's card or session | On the class roster the teacher uses **Sign out everywhere** (ends the student's sessions) or **Print a new card** (the old card stops working). |
| All sessions at once | There is no operator command yet ([#2555](https://github.com/corpora-inc/encorpora/issues/2555)). Take AMP offline instead. |

### Take AMP offline

Stop the deploy poll first, or the next release undoes this. Record what is suspended now, so restoring does not turn on a job that was off.

```sh
gh workflow disable deploy-corpora-amp.yml -R free2z/tuzi
kubectl -n $NS get cronjob -o custom-columns=NAME:.metadata.name,SUSPEND:.spec.suspend > ~/incidents/$(date -u +%F)/cronjobs-before.txt
kubectl -n $NS scale deployment/amp-api --replicas=0        # no API; the web shell still loads
for j in $(kubectl -n $NS get cronjob -o name); do kubectl -n $NS patch $j -p '{"spec":{"suspend":true}}'; done
kubectl -n $NS scale deployment/amp-sql-proxy --replicas=0  # also cuts every in-cluster database connection
```

The API's autoscaler does not scale up a Deployment set to zero. To restore, scale `amp-sql-proxy` and `amp-api` back to 2, un-suspend only the jobs that `cronjobs-before.txt` lists as `false`, then run `gh workflow enable deploy-corpora-amp.yml -R free2z/tuzi`.

## 4. Preserve evidence

Do this before cleaning anything up. Save every file to the incident folder named in the private runbook, never to a repository. Container logs and Secret Manager reads are kept for 30 days and the database's point-in-time window is 7 days, so do it on day one.

```sh
E=~/incidents/$(date -u +%F); SINCE=<RFC 3339 start of the suspect window>
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

Start from what the credential or account could reach. Then narrow with logs. The database keeps no statement or connection log ([free2z/tuzi#3026](https://github.com/free2z/tuzi/issues/3026)), so if a database credential was misused, assume everything `amp_prod` can read was read.

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
  school_people: `SELECT o.demo, count(DISTINCT o.id)::int AS orgs, count(p.id)::int AS people
                    FROM amp_orgs o LEFT JOIN amp_people p ON p.tenant_id = o.id AND p.deleted_at IS NULL
                   GROUP BY 1 ORDER BY 1`,
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
           (SELECT count(*) FROM amp_people p JOIN orgs ON orgs.id = p.tenant_id
             WHERE p.deleted_at IS NULL)::int AS people_administered`,
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

Demo orgs (`demo = true`) are synthetic. Leave them out of every count you report.

**A taken-over account.** Its reach is the `reach` row. Use the request log to see what it actually did. The log has no user id, so match the account's session addresses (`amp_auth_sessions."ipAddress"`) against `jsonPayload.req.remoteAddress`, and read its `amp_school_events`.

**Who to tell.** Only during an incident, print the notice list from the clone, or from prod in a read-only transaction:

```sql
SELECT 'class' AS kind, o.name AS school, a.signer_name, u.email
  FROM amp_class_authorizations a JOIN amp_classes c ON c.id = a.class_id JOIN amp_orgs o ON o.id = c.org_id
  LEFT JOIN amp_auth_users u ON 'amp|' || u.id = a.account_id
 WHERE NOT o.demo AND a.ended_at IS NULL
UNION ALL
SELECT 'school', o.name, a.signer_name, coalesce(u.email, p.email)
  FROM amp_data_agreements a JOIN amp_orgs o ON o.id = a.org_id
  LEFT JOIN amp_people p ON p.id = a.signer_person_id
  LEFT JOIN amp_auth_users u ON 'amp|' || u.id = a.signer_account_id
 WHERE NOT o.demo AND a.ended_at IS NULL;
```

**Which states.** AMP stores no home address. A family's state comes from its funding program (`amp_parent_followups.program`: `ar-efa`, `az-esa`, `nh-efa`), the billing address Stripe holds for paying customers, or the school's location.

**What kind of data.** AMP holds names, optional display names, emails, grade levels, school identifiers, class enrollments, answers and the skill evidence derived from them, hashed passwords and sign-in secrets, passkey public keys, and Stripe customer references. Cards stay with Stripe. AMP holds no Social Security, driver's license, financial account, health or biometric data. Write down which fields were exposed, and whether any credential that works was among them. The state statutes in section 6 turn on that.

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

For AMP's data, the line most likely to apply is Arizona's online-account credentials. Passwords and sign-in secrets are stored hashed, so a database copy alone does not expose working credentials. Plaintext credentials or live sessions do. Record the reasoning for each state either way.

## 7. Recover and close

1. Restore service (section 3). Confirm `/api/v1/health` reports the expected commit and the deploy poll is enabled.
2. Delete evidence clones and local copies once notices and any regulator questions are done. Keep the incident log and the notices sent.
3. Write the record in [`incident-exercises/`](incident-exercises/) (`YYYY-MM-DD-incident.md`), redacted for this public repository: timeline, cause, what was exposed in counts, notices with their dates, and changes made. That record is the program review 16 CFR 312.8(b)(5) requires.
4. File each gap as an issue. Account-specific or exploitable detail goes to the private repositories.

Run a tabletop at least once a year and after any real incident (16 CFR 312.8(b)(4)–(5)). Each one gets a dated record in [`incident-exercises/`](incident-exercises/).
