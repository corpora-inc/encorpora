"""Parser output: a document as an ordered tree of nodes, plus cross-references."""

from __future__ import annotations

from dataclasses import dataclass, field

# Kinds a section row can have (CONTRACT.md, table `section`).
KINDS = {"part", "subpart", "section", "paragraph", "table", "figure", "appendix", "note"}
# Containers whose `text` is only their own heading line, not the whole subtree.
HEADING_ONLY = {"part", "subpart"}


@dataclass
class Node:
    section_id: str
    kind: str
    citation: str
    heading: str | None = None
    own_text: str = ""            # this node's own text, exact, whitespace-normalized per line
    parent_id: str | None = None
    lang: str = "en"
    children: list["Node"] = field(default_factory=list)
    meta: dict = field(default_factory=dict)  # parser extras (e.g. figure src); not written to the pack

    def add(self, child: "Node") -> "Node":
        child.parent_id = self.section_id
        self.children.append(child)
        return child


@dataclass
class Xref:
    from_id: str
    to_id: str
    kind: str   # cites | external | standard


@dataclass
class ParsedDoc:
    source_id: str
    roots: list[Node]
    xrefs: list[Xref] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def walk(self):
        """Pre-order (document order) with depth."""
        stack = [(n, 0) for n in reversed(self.roots)]
        while stack:
            node, depth = stack.pop()
            yield node, depth
            stack.extend((c, depth + 1) for c in reversed(node.children))

    def by_id(self) -> dict[str, Node]:
        return {n.section_id: n for n, _ in self.walk()}


def subtree_text(node: Node) -> str:
    """Exact text for a citation path: own text plus every descendant's, in document order.

    Part and subpart rows hold only their own line (a subpart's full text is its sections).
    Figures contribute nothing to an ancestor's text.
    """
    if node.kind in HEADING_ONLY:
        return node.own_text
    parts: list[str] = []

    def rec(n: Node):
        if n.kind == "figure" and n is not node:
            return
        if n.own_text:
            parts.append(n.own_text)
        for c in n.children:
            rec(c)

    rec(node)
    return "\n".join(parts)
