// A sample for no-my-chrome.test.ts: what the check must find, and what it
// must leave alone. Never imported.
// My practice in a comment is not chrome.
const label = "My practice";
const lower = `my levels`;
const fine = "Practice at a level, for myself";
export const Sample = () => <p title={fine + label + lower}>My class</p>;
