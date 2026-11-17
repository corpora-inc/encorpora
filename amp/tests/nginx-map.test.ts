import assert from "node:assert/strict";
import test from "node:test";
import { documentRoutePatterns } from "../src/web/app/document-routes.js";
import {
  documentRoutesNginxMap,
  nginxRegexKey,
} from "../scripts/lib/nginx-map.js";

// nginx's parser unescapes \\ and \" inside a quoted string.
const unquote = (key: string) => key.slice(1, -1).replace(/\\(["\\])/g, "$1");

test("every route regex in the nginx map is a quoted key that reads back exactly", () => {
  const lines = documentRoutesNginxMap(documentRoutePatterns)
    .split("\n")
    .filter((line) => line.includes("~"));
  assert.equal(lines.length, documentRoutePatterns.length);
  lines.forEach((line, index) => {
    const match = /^ {2}("(?:[^"\\]|\\.)*") 1;$/.exec(line);
    assert.ok(match, `unquoted or malformed map entry: ${line}`);
    assert.equal(unquote(match[1]), `~${documentRoutePatterns[index]}`);
  });
});

test("a quantifier, a backslash and a quote survive quoting (an unquoted { stopped nginx)", () => {
  for (const pattern of ["^/a(?:/[^/]+){0,2}/?$", "^/b\\.html$", '^/c"d$'])
    assert.equal(unquote(nginxRegexKey(pattern)), `~${pattern}`);
  assert.ok(
    documentRoutePatterns.some((pattern) => /\{\d+,\d+\}/.test(pattern)),
    "the route table has a braced quantifier, the case this guards",
  );
});
