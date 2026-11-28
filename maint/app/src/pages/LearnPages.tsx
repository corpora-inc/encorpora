import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { reportError } from "@appkit/toast.ts";
import { call } from "../engine/client.ts";
import type { Lesson, Tree } from "../engine/types.ts";
import { LearnHome, TreeStudy } from "../screens/Learn.tsx";
import { NotFound } from "../screens/NotFound.tsx";
import { usePack } from "../store/pack.ts";

export function LearnPage() {
  const trees = usePack((s) => s.trees);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  useEffect(() => {
    call("lesson.list", {})
      .then((l) => setLessons([...l].reverse()))
      .catch((e: unknown) => reportError("learn.lessons", e, "Lessons could not be read."));
  }, []);
  return <LearnHome trees={trees} lessons={lessons} titles={Object.fromEntries(trees.map((t) => [t.tree_id, t.title]))} />;
}

export function TreeStudyPage() {
  const { treeId = "" } = useParams();
  const [tree, setTree] = useState<Tree | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    call("tree.get", { tree_id: treeId })
      .then(setTree)
      .catch((e: unknown) => {
        setMissing(true);
        reportError("learn.tree", e, "This table could not be read.");
      });
  }, [treeId]);
  if (!tree) return missing ? <NotFound /> : null;
  return <TreeStudy tree={tree} />;
}
