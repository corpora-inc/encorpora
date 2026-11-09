import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { SchoolError } from "./contracts.js";
import type { SchoolRepository } from "./repository.js";
import type { defineSchoolRoute, SchoolServices } from "./routes.js";
import {
  classroomRows,
  classroomSource,
  type ClassroomStudent,
} from "./sources/google-classroom.js";
import { limited } from "./sign-in-routes.js";

/** Google Classroom roster import, behind `AMP_GOOGLE_CLASSROOM_IMPORT=true`.
 * A staff member with `roster.import` consents to three read-only scopes, AMP
 * lists their active courses, and the one they pick becomes ordinary roster rows
 * for the usual dry run. The access token is kept server-side, encrypted, for
 * minutes, and deleted the moment the students are read. */
export const CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.profile.emails",
] as const;

export type ClassroomImport = {
  clientId: string;
  clientSecret: string;
  /** Overridable so a test can stand in for Google. */
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  apiBase?: string;
};
const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const API = "https://classroom.googleapis.com/v1";
const COOKIE = "amp_classroom_flow";
const COOKIE_PATH = "/api/v1/school/google-classroom";
const FLOW_SECONDS = 600;
const GRANT_SECONDS = 900;
const MAX_STUDENTS = 5000;
export const classroomCallbackPath = `${COOKIE_PATH}/callback`;
export const classroomRedirectUri = (origin: string) =>
  `${origin}${classroomCallbackPath}`;

/* Sealing: HMAC for the flow cookie, AES-GCM for the stored token. */
const key = (secret: string, purpose: string) =>
  createHash("sha256").update(`${purpose}:${secret}`).digest();
export function sealToken(secret: string, token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret, "classroom"), iv);
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body]
    .map((part) => part.toString("base64url"))
    .join(".");
}
export function openToken(secret: string, sealed: string): string | null {
  try {
    const [iv, tag, body] = sealed
      .split(".")
      .map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(secret, "classroom"),
      iv!,
    );
    decipher.setAuthTag(tag!);
    return Buffer.concat([decipher.update(body!), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}
type Flow = {
  account: string;
  org: string;
  /** The class the teacher started from, if any. */
  cls?: string;
  state: string;
  verifier: string;
  expires: number;
};
const sign = (secret: string, payload: string) =>
  createHmac("sha256", key(secret, "classroom-flow"))
    .update(payload)
    .digest("base64url");
const sealFlow = (secret: string, flow: Flow) => {
  const payload = Buffer.from(JSON.stringify(flow)).toString("base64url");
  return `${payload}.${sign(secret, payload)}`;
};
function openFlow(secret: string, sealed: string | undefined): Flow | null {
  const [payload, mac] = (sealed ?? "").split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(secret, payload));
  const actual = Buffer.from(mac);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return null;
  try {
    const flow = JSON.parse(Buffer.from(payload, "base64url").toString());
    return flow.expires > Date.now() ? (flow as Flow) : null;
  } catch {
    return null;
  }
}
function flowCookie(request: FastifyRequest): string | undefined {
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE) return value.join("=");
  }
  return undefined;
}
const setCookie = (value: string, maxAge: number, secure: boolean) =>
  `${COOKIE}=${value}; Path=${COOKIE_PATH}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;

/* The grant: one per person and school, replaced on each consent. */
async function saveGrant(
  repository: SchoolRepository,
  secret: string,
  account: string,
  org: string,
  token: string,
) {
  await repository.pool.query(
    "DELETE FROM amp_google_classroom_grants WHERE expires_at<now()",
  );
  await repository.pool.query(
    `INSERT INTO amp_google_classroom_grants(account_id,org_id,sealed_token,expires_at)
     VALUES($1,$2,$3,now()+make_interval(secs=>$4))
     ON CONFLICT(account_id,org_id) DO UPDATE SET sealed_token=EXCLUDED.sealed_token,expires_at=EXCLUDED.expires_at`,
    [account, org, sealToken(secret, token), GRANT_SECONDS],
  );
}
async function readGrant(
  repository: SchoolRepository,
  secret: string,
  account: string,
  org: string,
): Promise<string | null> {
  const row = (
    await repository.pool.query(
      `SELECT sealed_token FROM amp_google_classroom_grants
       WHERE account_id=$1 AND org_id=$2 AND expires_at>now()`,
      [account, org],
    )
  ).rows[0];
  return row ? openToken(secret, row.sealed_token) : null;
}
const dropGrant = (
  repository: SchoolRepository,
  account: string,
  org: string,
) =>
  repository.pool.query(
    "DELETE FROM amp_google_classroom_grants WHERE account_id=$1 AND org_id=$2",
    [account, org],
  );

/* Google's API: read-only, paged, and never trusted further than its shape. */
const coursesPage = z.object({
  courses: z
    .array(z.object({ id: z.string(), name: z.string().default("") }))
    .optional(),
  nextPageToken: z.string().optional(),
});
const studentsPage = z.object({
  students: z.array(z.custom<ClassroomStudent>()).optional(),
  nextPageToken: z.string().optional(),
});
async function google<T>(
  config: ClassroomImport,
  token: string,
  path: string,
  params: Record<string, string>,
  schema: z.ZodType<T>,
): Promise<T> {
  const url = new URL(`${config.apiBase ?? API}${path}`);
  for (const [name, value] of Object.entries(params))
    url.searchParams.set(name, value);
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 401 || response.status === 403)
    throw new SchoolError(409, "classroom_authorization_required");
  if (!response.ok) {
    console.error("Google Classroom request failed", path, response.status);
    throw new SchoolError(502, "classroom_unavailable");
  }
  return schema.parse(await response.json());
}
export async function listCourses(config: ClassroomImport, token: string) {
  const courses: { id: string; name: string }[] = [];
  let pageToken = "";
  do {
    const page = await google(
      config,
      token,
      "/courses",
      {
        teacherId: "me",
        courseStates: "ACTIVE",
        pageSize: "100",
        ...(pageToken ? { pageToken } : {}),
      },
      coursesPage,
    );
    courses.push(...(page.courses ?? []));
    pageToken = page.nextPageToken ?? "";
  } while (pageToken && courses.length < 500);
  return courses;
}
export async function listStudents(
  config: ClassroomImport,
  token: string,
  courseId: string,
) {
  const students: ClassroomStudent[] = [];
  let pageToken = "";
  do {
    const page = await google(
      config,
      token,
      `/courses/${encodeURIComponent(courseId)}/students`,
      { pageSize: "100", ...(pageToken ? { pageToken } : {}) },
      studentsPage,
    );
    students.push(...(page.students ?? []));
    pageToken = page.nextPageToken ?? "";
  } while (pageToken && students.length < MAX_STUDENTS);
  return students;
}

const enabled = (services: SchoolServices) => {
  if (!services.classroom) throw new SchoolError(404, "not_found");
  return services.classroom;
};
const courseBody = z.strictObject({
  courseId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  /** The class the teacher is on: its name is used so the import fills it. */
  classId: z.uuid().optional(),
});

export function defineGoogleClassroomRoutes(define: typeof defineSchoolRoute) {
  const org = ({ params }: { params: Record<string, string> }) =>
    ({ kind: "org", orgId: params.org! }) as const;
  const base = "/api/v1/school/orgs/:org/google-classroom";
  define({
    method: "GET",
    url: base,
    action: "roster.import",
    target: org,
    handler: async ({ actor, target, repository, services }) => {
      if (!services.classroom) return { enabled: false, authorized: false };
      return {
        enabled: true,
        authorized: !!(await readGrant(
          repository,
          services.secret,
          actor.accountId,
          target.orgId,
        )),
      };
    },
  });
  define({
    method: "POST",
    url: `${base}/authorize`,
    action: "roster.import",
    target: org,
    handler: async ({ actor, target, services, reply, request }) => {
      const config = enabled(services);
      const { classId } = z
        .strictObject({ classId: z.uuid().optional() })
        .parse(request.body ?? {});
      const flow: Flow = {
        account: actor.accountId,
        org: target.orgId,
        ...(classId ? { cls: classId } : {}),
        state: randomBytes(24).toString("base64url"),
        verifier: randomBytes(48).toString("base64url"),
        expires: Date.now() + FLOW_SECONDS * 1000,
      };
      reply.header(
        "Set-Cookie",
        setCookie(
          sealFlow(services.secret, flow),
          FLOW_SECONDS,
          services.origin.startsWith("https:"),
        ),
      );
      const url = new URL(config.authorizationEndpoint ?? AUTHORIZE);
      for (const [name, value] of Object.entries({
        client_id: config.clientId,
        redirect_uri: classroomRedirectUri(services.origin),
        response_type: "code",
        scope: CLASSROOM_SCOPES.join(" "),
        state: flow.state,
        code_challenge: createHash("sha256")
          .update(flow.verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
        include_granted_scopes: "true",
        access_type: "online",
        prompt: "consent",
      }))
        url.searchParams.set(name, value);
      return { url: url.href };
    },
  });
  define({
    method: "GET",
    url: `${base}/courses`,
    action: "roster.import",
    target: org,
    handler: async ({ actor, target, repository, services }) => {
      const config = enabled(services);
      const token = await readGrant(
        repository,
        services.secret,
        actor.accountId,
        target.orgId,
      );
      if (!token)
        throw new SchoolError(409, "classroom_authorization_required");
      return { courses: await listCourses(config, token) };
    },
  });
  define({
    method: "POST",
    url: `${base}/students`,
    action: "roster.import",
    target: org,
    handler: async ({ actor, target, repository, services, request }) => {
      const config = enabled(services);
      const body = courseBody.parse(request.body);
      const token = await readGrant(
        repository,
        services.secret,
        actor.accountId,
        target.orgId,
      );
      if (!token)
        throw new SchoolError(409, "classroom_authorization_required");
      try {
        const courses = await listCourses(config, token);
        const course = courses.find((found) => found.id === body.courseId);
        if (!course) throw new SchoolError(404, "classroom_course_not_found");
        const students = await listStudents(config, token, course.id);
        let name = course.name;
        if (body.classId) {
          const own = (
            await repository.pool.query(
              "SELECT name FROM amp_classes WHERE id=$1 AND org_id=$2 AND archived_at IS NULL",
              [body.classId, target.orgId],
            )
          ).rows[0];
          if (own) name = own.name;
        }
        const result = classroomRows({ id: course.id, name }, students);
        return {
          source: classroomSource(course.id),
          courseName: course.name,
          ...result,
        };
      } finally {
        // The token has done its one job; nothing else can read the course.
        await dropGrant(repository, actor.accountId, target.orgId);
      }
    },
  });
}

/** Where Google sends the teacher back. The signed cookie set at `authorize`
 * names the person and the school; nothing in the URL does. */
export function registerClassroomCallback(
  scope: FastifyInstance,
  repository: SchoolRepository,
  services: SchoolServices,
) {
  const secure = services.origin.startsWith("https:");
  scope.get(classroomCallbackPath, limited, async (request, reply) => {
    const config = services.classroom;
    const query = request.query as {
      code?: unknown;
      state?: unknown;
      error?: unknown;
    };
    const flow = openFlow(services.secret, flowCookie(request));
    reply.header("Set-Cookie", setCookie("", 0, secure));
    if (!config || !flow) return reply.redirect("/schools", 302);
    const back = (result: string) =>
      reply.redirect(
        `/school/${flow.org}/import?google=${result}${flow.cls && z.uuid().safeParse(flow.cls).success ? `&class=${flow.cls}` : ""}`,
        302,
      );
    if (typeof query.state !== "string" || query.state !== flow.state)
      return back("failed");
    if (typeof query.code !== "string") return back("declined");
    try {
      const response = await fetch(config.tokenEndpoint ?? TOKEN, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: query.code,
          redirect_uri: classroomRedirectUri(services.origin),
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code_verifier: flow.verifier,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await response.json().catch(() => null)) as {
        access_token?: unknown;
        scope?: unknown;
      } | null;
      if (!response.ok || typeof body?.access_token !== "string")
        throw new Error(`token endpoint ${response.status}`);
      // Consent can be unticked scope by scope: all three or nothing.
      const granted = String(body.scope ?? "").split(" ");
      if (!CLASSROOM_SCOPES.every((scopeName) => granted.includes(scopeName)))
        return back("scopes");
      await saveGrant(
        repository,
        services.secret,
        flow.account,
        flow.org,
        body.access_token,
      );
      return back("ready");
    } catch (error) {
      console.error("Google Classroom authorization failed", error);
      return back("failed");
    }
  });
}
