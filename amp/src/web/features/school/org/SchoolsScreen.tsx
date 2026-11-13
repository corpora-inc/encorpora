import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { AppError } from "../../../lib/AppError";
import { useLoggedError } from "../../../feedback";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { Select } from "../../../ui/Select";
import { Sheet } from "../../../ui/Sheet";
import { TextField } from "../../../ui/TextField";
import { call, currentSession, orgOptions, refreshSchool } from "../api";
import { OrgFrame } from "../OrgFrame";
import { FormNote, PageHead } from "../parts";
import { orgPath } from "../paths";
import { COMMON_ZONES } from "../SetupScreen";
import { schoolsOptions } from "./org-api";
import { SchoolTable } from "./OverviewScreen";
import schoolStyles from "../School.module.css";
import { z } from "zod";

function AddSchool({
  orgId,
  timezone,
  open,
  onOpenChange,
}: {
  orgId: string;
  timezone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const session = currentSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [zone, setZone] = useState(timezone);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState("");
  const [error, setError] = useState("");
  useLoggedError(error);
  const zones = COMMON_ZONES.some(([value]) => value === timezone)
    ? COMMON_ZONES
    : ([[timezone, timezone.replaceAll("_", " ")], ...COMMON_ZONES] as const);
  const submit = async () => {
    if (!name.trim()) {
      setNameError("Enter the school’s name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { school } = await call(
        `/orgs/${orgId}/schools`,
        z.object({ school: z.object({ id: z.uuid() }) }),
        session,
        { body: { name: name.trim(), timezone: zone } },
      );
      await refreshSchool(session);
      await navigate({ to: "/$", params: { _splat: orgPath(school.id) } });
    } catch (failure) {
      setError(
        failure instanceof AppError
          ? failure.message
          : "That school didn’t save. Try again.",
      );
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add a school">
      <form
        className={schoolStyles.sheetForm}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          label="School name"
          value={name}
          maxLength={200}
          autoComplete="off"
          error={nameError}
          onChange={(event) => {
            setName(event.target.value);
            setNameError("");
          }}
        />
        <div className={schoolStyles.field}>
          <span className={schoolStyles.fieldLabel}>Time zone</span>
          <Select aria-label="Time zone" value={zone} onValueChange={setZone}>
            {zones.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <p className={schoolStyles.fieldHelp}>
          It uses the district’s data agreement, calendar and seats until you
          give it its own.
        </p>
        <FormNote error={error} />
        <Button
          variant="primary"
          type="submit"
          className={schoolStyles.sheetAction}
          aria-busy={busy}
          disabled={busy}
        >
          Add school
        </Button>
      </form>
    </Sheet>
  );
}

/** A district's schools, with how each is using AMP. */
export function SchoolsScreen() {
  const { org: orgId } = useParams({ strict: false }) as { org: string };
  const search = useSearch({ strict: false }) as { add?: unknown };
  const navigate = useNavigate();
  const session = currentSession();
  const org = useQuery(orgOptions(session, orgId)).data;
  const schools = useQuery(schoolsOptions(session, orgId));
  const data = schools.data;
  const students = (data?.schools ?? []).reduce(
    (sum, row) => sum + row.students,
    0,
  );
  const canAdd = org?.can?.includes("schools.add") === true;
  const adding = search.add === 1 || search.add === "1";
  const setAdding = (open: boolean) =>
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        add: open ? 1 : undefined,
      })) as never,
    });
  return (
    <OrgFrame orgId={orgId} nav="schools" title="Schools">
      <PageHead
        title="Schools"
        detail={
          data
            ? `${data.schools.length} ${data.schools.length === 1 ? "school" : "schools"}, ${students.toLocaleString("en-US")} ${students === 1 ? "student" : "students"}`
            : " "
        }
      />
      {schools.isPending ? (
        <Loading />
      ) : !data ? (
        <EmptyState
          title="The schools didn’t load"
          action={
            <Button variant="secondary" onClick={() => void schools.refetch()}>
              Try again
            </Button>
          }
        />
      ) : data.schools.length ? (
        <SchoolTable
          rows={data.schools}
          action={
            canAdd ? (
              <Button variant="primary" onClick={() => setAdding(true)}>
                Add school
              </Button>
            ) : undefined
          }
        />
      ) : (
        <EmptyState
          title="No schools yet"
          action={
            canAdd ? (
              <Button variant="primary" onClick={() => setAdding(true)}>
                Add a school
              </Button>
            ) : undefined
          }
        >
          Each school gets its own classes, staff and overview, rolled up here.
        </EmptyState>
      )}
      {canAdd && data && (
        <AddSchool
          orgId={orgId}
          timezone={data.timezone}
          open={adding}
          onOpenChange={setAdding}
        />
      )}
    </OrgFrame>
  );
}
