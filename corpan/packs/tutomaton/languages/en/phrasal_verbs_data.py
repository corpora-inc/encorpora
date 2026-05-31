"""High-frequency English phrasal verbs (hand-curated top ~80).

Items contain:
  - verb, particle (the canonical two-part form: get + up)
  - meaning (concise English gloss)
  - example_en
  - separability: "separable" or "inseparable" or "three_part"
  - register: "neutral", "informal", "formal"
"""

PHRASAL_VERBS = [
    # GET
    {"verb": "get", "particle": "up", "meaning": "rise from bed; stand up", "example_en": "I get up at 7 every day.", "separability": "inseparable", "register": "neutral"},
    {"verb": "get", "particle": "on", "meaning": "board (a bus, train, plane); make progress", "example_en": "Get on the bus before it leaves.", "separability": "inseparable", "register": "neutral"},
    {"verb": "get", "particle": "off", "meaning": "disembark (a bus, train); leave work", "example_en": "I get off at the next stop.", "separability": "inseparable", "register": "neutral"},
    {"verb": "get", "particle": "in", "meaning": "enter (a car); arrive", "example_en": "Get in the car.", "separability": "inseparable", "register": "neutral"},
    {"verb": "get", "particle": "out", "meaning": "leave; escape", "example_en": "Get out of here!", "separability": "inseparable", "register": "neutral"},
    {"verb": "get", "particle": "over", "meaning": "recover from", "example_en": "It took me a week to get over the flu.", "separability": "inseparable", "register": "neutral"},
    {"verb": "get", "particle": "along", "meaning": "have a good relationship", "example_en": "I get along well with my coworkers.", "separability": "inseparable", "register": "neutral"},
    {"verb": "get", "particle": "back", "meaning": "return; receive again", "example_en": "When will you get back?", "separability": "inseparable", "register": "neutral"},
    {"verb": "get", "particle": "away", "meaning": "escape; leave", "example_en": "We got away for the weekend.", "separability": "inseparable", "register": "neutral"},
    {"verb": "get", "particle": "rid of", "meaning": "discard; eliminate", "example_en": "Get rid of those old shoes.", "separability": "three_part", "register": "neutral"},
    {"verb": "get", "particle": "through", "meaning": "finish; survive", "example_en": "I'll get through this somehow.", "separability": "inseparable", "register": "neutral"},
    {"verb": "get", "particle": "into", "meaning": "begin to enjoy; enter", "example_en": "I'm getting into jazz lately.", "separability": "inseparable", "register": "neutral"},
    {"verb": "get", "particle": "away with", "meaning": "avoid punishment for", "example_en": "He got away with cheating on the test.", "separability": "three_part", "register": "neutral"},

    # PUT
    {"verb": "put", "particle": "on", "meaning": "wear; apply", "example_en": "Put on your jacket — it's cold.", "separability": "separable", "register": "neutral"},
    {"verb": "put", "particle": "off", "meaning": "postpone; delay", "example_en": "Don't put off the dentist appointment.", "separability": "separable", "register": "neutral"},
    {"verb": "put", "particle": "up", "meaning": "raise; build; accommodate", "example_en": "Put up the picture on the wall.", "separability": "separable", "register": "neutral"},
    {"verb": "put", "particle": "out", "meaning": "extinguish; publish", "example_en": "Put out the fire.", "separability": "separable", "register": "neutral"},
    {"verb": "put", "particle": "down", "meaning": "place down; criticize harshly", "example_en": "Put the book down and listen.", "separability": "separable", "register": "neutral"},
    {"verb": "put", "particle": "away", "meaning": "store; eat (a lot of)", "example_en": "Put your toys away before dinner.", "separability": "separable", "register": "neutral"},
    {"verb": "put", "particle": "up with", "meaning": "tolerate; endure", "example_en": "I can't put up with this noise.", "separability": "three_part", "register": "neutral"},

    # TAKE
    {"verb": "take", "particle": "off", "meaning": "remove (clothes); depart (plane)", "example_en": "The plane takes off at 7.", "separability": "separable", "register": "neutral"},
    {"verb": "take", "particle": "on", "meaning": "accept (responsibility, challenge)", "example_en": "I took on too much work this month.", "separability": "separable", "register": "neutral"},
    {"verb": "take", "particle": "out", "meaning": "remove; invite on a date", "example_en": "Take out the trash.", "separability": "separable", "register": "neutral"},
    {"verb": "take", "particle": "up", "meaning": "begin a hobby; occupy (space, time)", "example_en": "I took up yoga last year.", "separability": "separable", "register": "neutral"},
    {"verb": "take", "particle": "after", "meaning": "resemble (a parent)", "example_en": "She takes after her mother.", "separability": "inseparable", "register": "neutral"},
    {"verb": "take", "particle": "over", "meaning": "assume control of", "example_en": "She took over the project.", "separability": "separable", "register": "neutral"},
    {"verb": "take", "particle": "back", "meaning": "retract; return", "example_en": "I take back what I said.", "separability": "separable", "register": "neutral"},
    {"verb": "take", "particle": "in", "meaning": "absorb (info); deceive; shelter", "example_en": "I couldn't take in all the information.", "separability": "separable", "register": "neutral"},

    # COME
    {"verb": "come", "particle": "in", "meaning": "enter", "example_en": "Come in and sit down.", "separability": "inseparable", "register": "neutral"},
    {"verb": "come", "particle": "out", "meaning": "be released; emerge; reveal an identity", "example_en": "Her new album came out yesterday.", "separability": "inseparable", "register": "neutral"},
    {"verb": "come", "particle": "back", "meaning": "return", "example_en": "I'll come back tomorrow.", "separability": "inseparable", "register": "neutral"},
    {"verb": "come", "particle": "across", "meaning": "encounter by chance; give an impression", "example_en": "I came across this old letter.", "separability": "inseparable", "register": "neutral"},
    {"verb": "come", "particle": "up", "meaning": "arise; approach", "example_en": "An interesting topic came up in the meeting.", "separability": "inseparable", "register": "neutral"},
    {"verb": "come", "particle": "up with", "meaning": "invent; propose", "example_en": "She came up with a great idea.", "separability": "three_part", "register": "neutral"},
    {"verb": "come", "particle": "over", "meaning": "visit; suddenly affect", "example_en": "Come over for dinner Saturday.", "separability": "inseparable", "register": "neutral"},
    {"verb": "come", "particle": "down with", "meaning": "fall ill with", "example_en": "I'm coming down with a cold.", "separability": "three_part", "register": "neutral"},

    # GO
    {"verb": "go", "particle": "on", "meaning": "continue; happen", "example_en": "Go on with your story.", "separability": "inseparable", "register": "neutral"},
    {"verb": "go", "particle": "out", "meaning": "leave home for social purposes; be extinguished", "example_en": "Let's go out for dinner.", "separability": "inseparable", "register": "neutral"},
    {"verb": "go", "particle": "off", "meaning": "explode; ring (alarm); go bad (food)", "example_en": "The alarm went off at 6.", "separability": "inseparable", "register": "neutral"},
    {"verb": "go", "particle": "back", "meaning": "return", "example_en": "I want to go back home.", "separability": "inseparable", "register": "neutral"},
    {"verb": "go", "particle": "through", "meaning": "experience; examine", "example_en": "She went through a tough time.", "separability": "inseparable", "register": "neutral"},
    {"verb": "go", "particle": "over", "meaning": "review; examine", "example_en": "Let's go over the plan again.", "separability": "inseparable", "register": "neutral"},
    {"verb": "go", "particle": "ahead", "meaning": "proceed; start", "example_en": "Go ahead and ask your question.", "separability": "inseparable", "register": "neutral"},

    # LOOK
    {"verb": "look", "particle": "for", "meaning": "search for", "example_en": "I'm looking for my keys.", "separability": "inseparable", "register": "neutral"},
    {"verb": "look", "particle": "after", "meaning": "take care of", "example_en": "Can you look after my dog?", "separability": "inseparable", "register": "neutral"},
    {"verb": "look", "particle": "up", "meaning": "search in a reference; improve", "example_en": "Look up the word in the dictionary.", "separability": "separable", "register": "neutral"},
    {"verb": "look", "particle": "forward to", "meaning": "anticipate with pleasure", "example_en": "I'm looking forward to the weekend.", "separability": "three_part", "register": "neutral"},
    {"verb": "look", "particle": "into", "meaning": "investigate", "example_en": "We'll look into the problem.", "separability": "inseparable", "register": "neutral"},
    {"verb": "look", "particle": "out", "meaning": "be careful", "example_en": "Look out! There's a car!", "separability": "inseparable", "register": "neutral"},
    {"verb": "look", "particle": "over", "meaning": "examine briefly", "example_en": "Could you look over my essay?", "separability": "separable", "register": "neutral"},
    {"verb": "look", "particle": "down on", "meaning": "consider inferior", "example_en": "Don't look down on people who try.", "separability": "three_part", "register": "neutral"},

    # MAKE / GIVE / BREAK / TURN / SET
    {"verb": "make", "particle": "up", "meaning": "invent; reconcile; apply cosmetics", "example_en": "She made up a story.", "separability": "separable", "register": "neutral"},
    {"verb": "make", "particle": "out", "meaning": "discern; succeed", "example_en": "I can't make out the words.", "separability": "separable", "register": "neutral"},
    {"verb": "make", "particle": "up for", "meaning": "compensate for", "example_en": "I'll make up for my mistake.", "separability": "three_part", "register": "neutral"},
    {"verb": "give", "particle": "up", "meaning": "quit; surrender", "example_en": "Don't give up!", "separability": "separable", "register": "neutral"},
    {"verb": "give", "particle": "back", "meaning": "return", "example_en": "Give me back my pen.", "separability": "separable", "register": "neutral"},
    {"verb": "give", "particle": "in", "meaning": "yield; submit", "example_en": "Don't give in to pressure.", "separability": "inseparable", "register": "neutral"},
    {"verb": "give", "particle": "out", "meaning": "distribute; stop functioning", "example_en": "She gave out flyers at the event.", "separability": "separable", "register": "neutral"},
    {"verb": "break", "particle": "up", "meaning": "end a relationship; disperse", "example_en": "They broke up last month.", "separability": "separable", "register": "neutral"},
    {"verb": "break", "particle": "down", "meaning": "stop working; lose composure", "example_en": "My car broke down on the highway.", "separability": "inseparable", "register": "neutral"},
    {"verb": "break", "particle": "out", "meaning": "begin suddenly (war, fire); escape", "example_en": "Fire broke out in the building.", "separability": "inseparable", "register": "neutral"},
    {"verb": "turn", "particle": "on", "meaning": "activate; attack suddenly", "example_en": "Turn on the light.", "separability": "separable", "register": "neutral"},
    {"verb": "turn", "particle": "off", "meaning": "deactivate; disgust", "example_en": "Turn off the TV before bed.", "separability": "separable", "register": "neutral"},
    {"verb": "turn", "particle": "down", "meaning": "reject; reduce volume", "example_en": "She turned down the job offer.", "separability": "separable", "register": "neutral"},
    {"verb": "turn", "particle": "up", "meaning": "appear; increase volume", "example_en": "He turned up late.", "separability": "separable", "register": "neutral"},
    {"verb": "turn", "particle": "into", "meaning": "become; transform", "example_en": "The caterpillar turned into a butterfly.", "separability": "inseparable", "register": "neutral"},
    {"verb": "set", "particle": "up", "meaning": "establish; prepare", "example_en": "Let's set up a meeting.", "separability": "separable", "register": "neutral"},
    {"verb": "set", "particle": "off", "meaning": "depart; trigger", "example_en": "We set off at dawn.", "separability": "separable", "register": "neutral"},

    # MISC HIGH-FREQUENCY
    {"verb": "run", "particle": "into", "meaning": "meet unexpectedly; encounter (problems)", "example_en": "I ran into Sarah at the store.", "separability": "inseparable", "register": "neutral"},
    {"verb": "run", "particle": "out of", "meaning": "exhaust supply of", "example_en": "We're running out of milk.", "separability": "three_part", "register": "neutral"},
    {"verb": "find", "particle": "out", "meaning": "discover (information)", "example_en": "How did you find out?", "separability": "inseparable", "register": "neutral"},
    {"verb": "figure", "particle": "out", "meaning": "solve; understand", "example_en": "I can't figure out this puzzle.", "separability": "separable", "register": "neutral"},
    {"verb": "carry", "particle": "on", "meaning": "continue", "example_en": "Carry on with what you were doing.", "separability": "inseparable", "register": "neutral"},
    {"verb": "hold", "particle": "on", "meaning": "wait; grasp", "example_en": "Hold on a minute!", "separability": "inseparable", "register": "neutral"},
    {"verb": "hang", "particle": "out", "meaning": "spend time casually", "example_en": "Let's hang out this weekend.", "separability": "inseparable", "register": "informal"},
    {"verb": "hang", "particle": "up", "meaning": "end a phone call", "example_en": "Don't hang up — I have one more thing.", "separability": "inseparable", "register": "neutral"},
    {"verb": "show", "particle": "up", "meaning": "appear; arrive", "example_en": "He didn't show up for the meeting.", "separability": "inseparable", "register": "neutral"},
    {"verb": "show", "particle": "off", "meaning": "display ostentatiously", "example_en": "He's just showing off his new car.", "separability": "inseparable", "register": "neutral"},
    {"verb": "work", "particle": "out", "meaning": "exercise; succeed; calculate", "example_en": "I work out three times a week.", "separability": "inseparable", "register": "neutral"},
    {"verb": "pick", "particle": "up", "meaning": "lift; collect; learn casually", "example_en": "Can you pick up some milk?", "separability": "separable", "register": "neutral"},
    {"verb": "drop", "particle": "off", "meaning": "deliver; fall asleep", "example_en": "I'll drop you off at the airport.", "separability": "separable", "register": "neutral"},
    {"verb": "back", "particle": "up", "meaning": "support; make a backup copy", "example_en": "Back up your files regularly.", "separability": "separable", "register": "neutral"},
    {"verb": "fill", "particle": "in", "meaning": "complete (a form); substitute", "example_en": "Please fill in the form.", "separability": "separable", "register": "neutral"},
    {"verb": "fill", "particle": "out", "meaning": "complete (a form)", "example_en": "Fill out this application.", "separability": "separable", "register": "neutral"},
    {"verb": "check", "particle": "in", "meaning": "register at hotel/airport", "example_en": "We checked in at 3 PM.", "separability": "inseparable", "register": "neutral"},
    {"verb": "check", "particle": "out", "meaning": "leave (hotel); examine; borrow (library)", "example_en": "Check out this article.", "separability": "separable", "register": "neutral"},
]


MODAL_VERBS = [
    {"modal": "can", "function": "ability", "meaning": "be able to (general)", "example_en": "She can speak three languages.", "notes": "present tense; no -s on third person"},
    {"modal": "can", "function": "permission", "meaning": "may (informal)", "example_en": "Can I leave early?", "notes": "informal 'may'"},
    {"modal": "can", "function": "possibility", "meaning": "general possibility", "example_en": "Mistakes can happen.", "notes": ""},
    {"modal": "could", "function": "past ability", "meaning": "was/were able to (general)", "example_en": "When I was young, I could run fast.", "notes": "general past ability only"},
    {"modal": "could", "function": "polite request", "meaning": "polite form of can", "example_en": "Could you help me?", "notes": "politer than 'can'"},
    {"modal": "could", "function": "possibility", "meaning": "maybe (specific)", "example_en": "That could be Sarah at the door.", "notes": ""},
    {"modal": "could have", "function": "past possibility", "meaning": "it was possible that", "example_en": "She could have called.", "notes": "could + have + V3"},
    {"modal": "may", "function": "permission", "meaning": "formal permission", "example_en": "May I come in?", "notes": "formal alternative to 'can'"},
    {"modal": "may", "function": "possibility", "meaning": "maybe (formal/written)", "example_en": "It may rain tomorrow.", "notes": ""},
    {"modal": "might", "function": "possibility", "meaning": "maybe (slightly less certain than may)", "example_en": "She might be home.", "notes": ""},
    {"modal": "might have", "function": "past possibility", "meaning": "it's possible that... did", "example_en": "He might have forgotten.", "notes": "might + have + V3"},
    {"modal": "will", "function": "future", "meaning": "future predictions; spontaneous decisions", "example_en": "I'll help you.", "notes": "contraction: 'll; negative: won't"},
    {"modal": "will", "function": "promise", "meaning": "make a promise/offer", "example_en": "I will always remember you.", "notes": ""},
    {"modal": "would", "function": "conditional", "meaning": "result clause of conditional", "example_en": "If I had time, I would help.", "notes": ""},
    {"modal": "would", "function": "polite", "meaning": "politer form of will", "example_en": "Would you like some coffee?", "notes": ""},
    {"modal": "would have", "function": "past hypothetical", "meaning": "third conditional result", "example_en": "I would have called, but I forgot.", "notes": "would + have + V3"},
    {"modal": "shall", "function": "future formal", "meaning": "I/we form of will (formal/British)", "example_en": "Shall we go?", "notes": "rare in American English"},
    {"modal": "should", "function": "advice", "meaning": "it would be a good idea", "example_en": "You should see a doctor.", "notes": ""},
    {"modal": "should have", "function": "past advice/regret", "meaning": "it would have been good if...", "example_en": "You should have called me.", "notes": "should + have + V3"},
    {"modal": "must", "function": "strong obligation", "meaning": "have to (formal/internal)", "example_en": "You must finish this today.", "notes": "no past form; use 'had to'"},
    {"modal": "must", "function": "deduction", "meaning": "I'm sure (positive)", "example_en": "She must be tired.", "notes": "positive certainty"},
    {"modal": "must have", "function": "past deduction", "meaning": "I'm sure ... did", "example_en": "He must have left already.", "notes": "must + have + V3"},
    {"modal": "mustn't", "function": "prohibition", "meaning": "forbidden", "example_en": "You mustn't smoke here.", "notes": "NOT 'don't have to'"},
    {"modal": "ought to", "function": "advice", "meaning": "should (slightly more formal)", "example_en": "You ought to try this dish.", "notes": "with 'to'; unusual among modals"},
    {"modal": "have to", "function": "external obligation", "meaning": "be required to", "example_en": "I have to work tomorrow.", "notes": "changes for tense/person: had to, has to, will have to"},
    {"modal": "don't have to", "function": "no obligation", "meaning": "not required (optional)", "example_en": "You don't have to come if you don't want.", "notes": "different meaning from mustn't"},
    {"modal": "can't", "function": "negative certainty", "meaning": "I'm sure NOT", "example_en": "That can't be true.", "notes": "NOT mustn't for deduction"},
    {"modal": "can't have", "function": "past negative deduction", "meaning": "I'm sure ... didn't", "example_en": "He can't have seen us — he was asleep.", "notes": "can't + have + V3"},
]
