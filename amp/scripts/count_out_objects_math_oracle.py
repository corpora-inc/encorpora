"""Choose the ten-frame whose counters match the asked count."""
import re

SUPPORTED = frozenset({"count-out-objects"})
CHOICE_REVIEW = SUPPORTED


def require(condition, message):
    if not condition:
        raise ValueError(message)


def shown_count(label):
    match = re.search(r"shows (\d+) counters?\b", label)
    require(match is not None, f"Label names no count: {label!r}")
    return int(match.group(1))


def solve(public):
    require(public["templateId"] in SUPPORTED, "Wrong family")
    asked = re.fullmatch(r"Which frame shows (\d+) counters?\?", public["prompt"])
    require(asked is not None, "Unexpected count-out prompt")
    n = int(asked.group(1))
    require(1 <= n <= 20, "Count out stays within 1 to 20")
    options = public["response"]["options"]
    require(len(options) == 4, "Four frames")
    matches = []
    counts = []
    for option in options:
        count = shown_count(option["label"])
        scene = option["scene"]
        require(scene.get("title") is None and scene.get("steps") is None, "A choice frame is untitled")
        require((scene.get("width") or 360) <= 280, "Frame wider than a card")
        frames = [element for element in scene["elements"] if element["type"] == "tenFrame"]
        require(len(frames) == 1, "Each option is one ten-frame")
        frame = frames[0]
        require(frame["frames"] in (1, 2) and frame["frames"] * 10 >= count, "The frame cannot hold the counters")
        drawn = sum(group["count"] for group in frame["groups"])
        require(drawn == count, "The label and the frame disagree")
        if count > 10:
            require(frame["frames"] == 2, "A teen uses two frames")
        counts.append(count)
        if count == n and "loose" not in option["label"]:
            matches.append(option["id"])
    require(len(matches) == 1, "One frame shows the asked count")
    require(n - 1 in counts, "The one-short frame is missing")
    if n + 1 <= 20:
        require(n + 1 in counts, "The one-too-many frame is missing")
    if n >= 11:
        require(n - 10 in counts, "The loose-counters frame is missing")
    return matches[0]


def review_problem(problem):
    expected = solve(problem["public"])
    require(problem["answer"] == expected, f"Answer {problem['answer']} != {expected}")
    n = int(re.search(r"(\d+)", problem["public"]["prompt"]).group(1))
    wrong = {option["id"] for option in problem["public"]["response"]["options"]} - {expected}
    require(set(problem.get("choiceFeedback") or {}) == wrong, "Feedback for each wrong frame")
    if n + 1 <= 20:
        too_many = next(
            option["id"]
            for option in problem["public"]["response"]["options"]
            if shown_count(option["label"]) == n + 1
        )
        require("one too many" in problem["choiceFeedback"][too_many], "One too many is named")
    return expected


def self_test():
    def option(index, count, loose=False):
        frames = 2 if count > 10 else 1
        groups = (
            [{"count": 10, "shape": "dot", "color": "accent"}, {"count": count - 10, "shape": "dot", "color": "warm"}]
            if count > 10
            else [{"count": count, "shape": "dot", "color": "accent"}]
        )
        label = (
            f"A frame that shows {count} counters, only the loose ones, with no full ten."
            if loose
            else f"A frame that shows {count} counters. The other places are empty."
        )
        return {
            "id": f"option-{index}",
            "label": label,
            "scene": {
                "v": 1,
                "width": 240,
                "maxHeight": 280 if frames == 2 else 160,
                "elements": [{"type": "tenFrame", "id": "frame", "frames": frames, "groups": groups}],
            },
        }
    options = [option("a", 7), option("b", 6), option("c", 8), option("d", 10)]
    problem = {
        "public": {
            "templateId": "count-out-objects",
            "prompt": "Which frame shows 7 counters?",
            "response": {"kind": "figure-choice", "noun": "Picture", "options": options},
        },
        "answer": "option-a",
        "hint": "The question asks for 7.",
        "explanation": ["Count the counters."],
        "choiceFeedback": {
            "option-b": "One short.",
            "option-c": "That frame has one too many counters.",
            "option-d": "Counted the cells.",
        },
    }
    require(review_problem(problem) == "option-a", "Seven counters")
    return {"ok": True}


if __name__ == "__main__":
    print(self_test())
