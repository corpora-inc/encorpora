import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { reportError } from "@appkit/toast.ts";
import { call } from "../engine/client.ts";
import type { Lesson, Tree } from "../engine/types.ts";
import { LearnHome } from "../screens/Learn.tsx";
import { TreeStudy } from "../screens/Learn.tsx";
import { NotFound } from "../screens/NotFound.tsx";
import { packTitle, treeTitles, usePack } from "../store/pack.ts";
import { ManualPack } from "../ui/manual.tsx";

export function LearnPage() {
  const { packs, ids } = usePack();
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  useEffect(() => {
    call("lesson.list", {})
      .then((l) => setLessons([...l].reverse()))
      .catch((e: unknown) => reportError("learn.lessons", e, "Lessons could not be read."));
  }, []);
  const groups = ids.map((id) => ({ packId: id, title: packTitle(packs[id]!), trees: packs[id]!.trees }));
  return <LearnHome groups={groups} lessons={lessons} titles={treeTitles(packs)} />;
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
