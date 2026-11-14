// A sample for no-my-chrome.test.ts: what the check must find, and what it
// must leave alone. Never imported.
// My practice in a comment is not chrome.
const label = "My practice";
const lower = `my levels`;
const inside = "Keep my settings";
const tail = `Set it up ${label} for my child`;
const fine = "Practice at a level, for myself, in my-chrome.css";
export const Sample = () => (
  <p title={fine + label + lower + inside + tail}>My class</p>
);
