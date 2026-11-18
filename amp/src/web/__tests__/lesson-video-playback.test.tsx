import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { lessonVideos } from "../../content/lesson-videos";
import { LessonVideo } from "../LessonVideo";
import { onHelp, resetHelpForTests, helpUsedBefore } from "../lib/help-events";

afterEach(() => {
  cleanup();
  resetHelpForTests();
});

test("a lesson video records its opening, its first play and its end", () => {
  const video = lessonVideos[0]!;
  const kinds: string[] = [];
  const off = onHelp((note) => kinds.push(note.kind));
  const { container, getByRole } = render(
    <LessonVideo
      video={video}
      templateId={video.templateIds[0]}
      help={{ source: "practice", problemId: "p1" }}
    />,
  );
  fireEvent.click(getByRole("button", { name: /watch an example/i }));
  const player = container.querySelector("video")!;
  fireEvent.playing(player);
  fireEvent.pause(player);
  // Playing again after a pause is the same playback.
  fireEvent.playing(player);
  fireEvent.ended(player);
  // Watched again to the end: still one playback, one completion.
  fireEvent.playing(player);
  fireEvent.ended(player);
  off();
  expect(kinds).toEqual(["video", "video_play", "video_complete"]);
  // The answer names the video once, never its playback.
  expect(helpUsedBefore("p1")).toEqual(["video"]);
});
