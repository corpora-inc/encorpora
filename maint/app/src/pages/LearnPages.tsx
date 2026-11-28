import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { reportError } from "@appkit/toast.ts";
import { call } from "../engine/client.ts";
import type { Lesson, Tree } from "../engine/types.ts";
import { LearnHome } from "../screens/Learn.tsx";
import { TreeStudy } from "../screens/Learn.tsx";
import { NotFound } from "../screens/NotFound.tsx";
import { PracticeItem, PracticeSummary } from "../screens/Practice.tsx";
import { reportOf, usePractice } from "../store/practice.ts";
import { packTitle, treeTitles, usePack } from "../store/pack.ts";
import { ManualPack } from "../ui/manual.tsx";

export function LearnPage() {
  const { packs, ids } = usePack();
  const practice = usePractice((s) => s.packs);
  useEffect(() => {
    for (const id of ids) if (practice[id] === undefined) void usePractice.getState().load(id);
  }, [ids.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  useEffect(() => {
    call("lesson.list", {})
      .then((l) => setLessons([...l].reverse()))
      .catch((e: unknown) => reportError("learn.lessons", e, "Lessons could not be read."));
  }, []);
  const groups = ids.map((id) => ({ packId: id, title: packTitle(packs[id]!), trees: packs[id]!.trees }));
  const now = Date.now();
  const summaries = ids.flatMap((id) => {
    const p = practice[id];
    if (!p) return [];
    return [
      <div key={id} className="flex flex-col gap-1">
        {ids.length > 1 && <p className="manual-text text-small font-semibold text-ink-2">{packTitle(packs[id]!)}</p>}
        <PracticeSummary packId={id} items={p.items} report={reportOf(p, now)} />
      </div>,
    ];
  });
  return <LearnHome groups={groups} lessons={lessons} titles={treeTitles(packs)} practice={summaries.length ? <div className="grid items-start gap-6 lg:grid-cols-2">{summaries}</div> : null} />;
}

export function PracticePage() {
  const { packId = "" } = useParams();
  const p = usePractice((s) => s.packs[packId]);
  const busy = usePractice((s) => s.busy);
  useEffect(() => {
    if (p === undefined) void usePractice.getState().load(packId);
  }, [packId, p]);
  if (p === undefined || p === null) return null;
  if (p === false) return <NotFound />;
  const q = p.pick ? (p.byId[p.pick.item.id] ?? null) : null;
  const skill = q ? p.items.skills.find((s) => s.skill_id === q.skill_id) : undefined;
  const topic = skill ? p.items.topics.find((t) => t.topic_id === skill.topic_id) : undefined;
  return (
    <ManualPack.Provider value={packId}>
      <PracticeItem
        packId={packId}
        question={q}
        skillTitle={skill?.title ?? "Practice"}
        topicTitle={topic?.title ?? ""}
        reason={p.pick?.reason ?? null}
        chosen={p.chosen}
        busy={busy}
        onChoose={(i) => void usePractice.getState().choose(packId, i)}
        onNext={() => usePractice.getState().next(packId)}
      />
    </ManualPack.Provider>
  );
}

export function TreeStudyPage() {
  const { packId = "", treeId = "" } = useParams();
  const [tree, setTree] = useState<Tree | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    call("tree.get", { pack_id: packId, tree_id: treeId })
      .then(setTree)
      .catch((e: unknown) => {
        setMissing(true);
        reportError("learn.tree", e, "This table could not be read.");
      });
  }, [packId, treeId]);
  if (!tree) return missing ? <NotFound /> : null;
  return (
    <ManualPack.Provider value={packId}>
      <TreeStudy tree={tree} />
    </ManualPack.Provider>
  );
}
