/**
 * The room Colorful's points chip keeps on the page (the end of a student's
 * topic line on a phone, the end of the topic in the bar from 640 px:
 * celebration/skin.css) belongs to the problem on screen, not to the look.
 *
 * The look can change under an open problem: an adult turns "Allow Colorful"
 * off or on from another device, and the screen follows in about a second
 * (look-feed.ts). If the chip's room came and went with the look, a skill's
 * name would wrap or unwrap under the child at that moment. So the room is
 * settled as each problem arrives, from the look it arrives in, and stays
 * until the next one:
 *
 * - Colorful, then Calm under the same problem: the chip goes, its room
 *   stays, nothing moves; the next problem has the whole line.
 * - Calm, then Colorful under the same problem: the colors come, the chip
 *   waits (there is no room to put it in); the next problem has both.
 *
 * `data-chip-room` on `<html>` says the room is kept.
 */
const ROOM = "data-chip-room";

/** A problem arrived (or the screen's own look did): the chip's room is
 * kept if the page wears Colorful now. */
export function settleChipRoom() {
  const root = document.documentElement;
  if (root.getAttribute("data-look") === "bold") root.setAttribute(ROOM, "");
  else root.removeAttribute(ROOM);
}
