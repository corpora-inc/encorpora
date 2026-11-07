import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { shareStateResource } from "../../../schools/share-contracts";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { request } from "../../lib/api";

type Session = AuthSession | null;
const path = (student: string) => `/school/students/${student}/share`;
const key = (session: Session, student: string) =>
  ["account", session?.accountId, "school", "share", student] as const;

export const shareOptions = (session: Session, student: string) =>
  queryOptions({
    queryKey: key(session, student),
    enabled: !!session,
    queryFn: ({ signal }) =>
      request(path(student), shareStateResource, {
        token: session?.token,
        signal,
      }),
  });

export function useShareChange(session: Session, student: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (change: "make" | "revoke") =>
      request(
        change === "make" ? path(student) : `${path(student)}/revoke`,
        shareStateResource,
        { token: session?.token, body: {} },
      ),
    onSuccess: (state) => client.setQueryData(key(session, student), state),
  });
}

/** Every student in the class gets a fresh link, as a file for the school's own
 * mail system. Links made before stop working, so it's asked for on purpose. */
export async function downloadParentLinks(session: Session, classId: string) {
  const response = await fetch(
    `/api/v1/school/classes/${classId}/parent-links`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.token ?? ""}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );
  if (!response.ok) {
    const failure = new AppError(
      "unavailable",
      "The family links didn’t download. Links from before still work. Check your connection and try again.",
      true,
      response.headers.get("x-request-id"),
      null,
      response.status,
    );
    failure.log();
    throw failure;
  }
  const name =
    /filename="([^"]+)"/.exec(
      response.headers.get("content-disposition") ?? "",
    )?.[1] ?? "family-links.csv";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
