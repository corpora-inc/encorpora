"""
Per-pack facet definitions for the v0.2.0 expansion.

Each pack is broken into 5 (WIDE → 500-target) or 8 (DEEP → 800-target)
facets. Each facet is a focused sub-aspect of the topic that codex can
author ~100 phrases against without exhausting itself.

Format:
    PACK_ID: [
        (facet_name, facet_brief),
        ...
    ]

facet_name: short, headline-style (≤6 words)
facet_brief: 1-2 sentence editorial direction; what should and should not
             land in this batch

Tier is keyed in TIER below. Editing this file IS the editorial pacing
decision of each pack's expansion.
"""

TIER = {
    # DEEP (10 packs, 800-target, 8 facets each)
    "phrase-humanities-philosophy-basics": "DEEP",
    "phrase-learning": "DEEP",
    "phrase-humanities-mythology-world": "DEEP",
    "phrase-life-family-and-friends": "DEEP",
    "phrase-life-cooking-basics": "DEEP",
    "phrase-arts-music-fundamentals": "DEEP",
    "phrase-nature-the-ocean": "DEEP",
    "phrase-places-geography-world": "DEEP",
    "phrase-life-festivals-world": "DEEP",
    "phrase-life-health-and-body": "DEEP",

    # WIDE (14 packs, 500-target, 5 facets each)
    "phrase-sciences-astronomy-night-sky": "WIDE",
    "phrase-nature-birds-everyday": "WIDE",
    "phrase-sports-soccer-basics": "WIDE",
    "phrase-sports-martial-arts": "WIDE",
    "phrase-arts-cinema-and-film": "WIDE",
    "phrase-life-the-night": "WIDE",
    "phrase-life-camping-basics": "WIDE",
    "phrase-vehicles-cars-and-driving": "WIDE",
    "phrase-botany-basics": "WIDE",
    "phrase-geology-basics": "WIDE",
    "phrase-tech-computers-basics": "WIDE",
    "phrase-travel-essentials": "WIDE",
    "phrase-humanities-economics-basics": "WIDE",
    "phrase-work-office-basics": "WIDE",
}


FACETS = {

    # ====================== WIDE (5 facets, 500-target) ======================

    "phrase-sciences-astronomy-night-sky": [
        ("the moon & near-Earth",
         "Phases, eclipses, tides, the moon's long companionship with the "
         "planet. Includes near-Earth objects, the ISS, occasional comets."),
        ("stars & constellations",
         "Naming, navigation, what the night sky has meant in different "
         "cultures; Polaris, the zodiac, the Milky Way as river of light."),
        ("planets & the solar system",
         "Each planet's character; the eye-versus-telescope view; what a "
         "century of probes has taught us about our neighbors."),
        ("telescopes & the long history of looking up",
         "Early astronomers, Galileo, observatories, radio astronomy, the "
         "camera replacing the eye; amateur stargazing today."),
        ("the deep cosmos & humility",
         "Galaxies, the age of light, black holes, the cosmic background; "
         "what the universe's size does to the imagination."),
    ],

    "phrase-nature-birds-everyday": [
        ("garden & feeder birds",
         "Sparrows, finches, chickadees, cardinals, robins; the patient "
         "watcher at the kitchen window; bird tables and feeders."),
        ("city & rooftop birds",
         "Pigeons, crows, gulls, peregrine falcons, swifts; how birds use "
         "the built environment; the urban dawn chorus."),
        ("songs, calls, & dawn chorus",
         "Birdsong as identification; learning calls; spring mornings, "
         "evening roosts; the rhythm of birdsong through the year."),
        ("migration & seasons",
         "Long-distance migrants, the autumn departure, the spring return; "
         "swallows, geese, hummingbirds; navigation mysteries."),
        ("nests, eggs, & raising young",
         "Nest-building, brooding, fledging, the parental work of birds; "
         "what to leave alone in your garden in May."),
    ],

    "phrase-sports-soccer-basics": [
        ("rules & the pitch",
         "Offside, free kicks, fouls, throw-ins, the geometry of the field; "
         "what each line and circle means."),
        ("training & drills",
         "Practice, fitness, coaching, drills; the long road to a first XI; "
         "youth academies."),
        ("fans & culture",
         "Chants, scarves, rivalries, the pub, the supporter's relationship "
         "with the club; pre-match rituals."),
        ("history & the World Cup",
         "Famous matches, legends (Pelé, Maradona, Messi), the international "
         "stage, Euros and Copa America."),
        ("life of a player",
         "Locker room, transfers, injuries, the inner game; what a 90-minute "
         "match looks like from the inside."),
    ],

    "phrase-sports-martial-arts": [
        ("karate & striking arts",
         "Karate, Muay Thai, kickboxing, kata, kihon; the discipline of "
         "striking; the karate gi."),
        ("judo, BJJ & grappling",
         "Throws, groundwork, joint locks, chokes; the Brazilian Jiu-Jitsu "
         "academy; the patient art of grappling."),
        ("kung fu & internal arts",
         "Wing chun, tai chi, qigong, Shaolin tradition; the Chinese "
         "martial inheritance; soft style and hard style."),
        ("the dojo & the way",
         "Respect, bowing, sensei, kohai, the ethics of training; what a "
         "good school feels like; the long student-teacher relationship."),
        ("competition & sparring",
         "Tournaments, belt tests, the inner game of nerves; mixed martial "
         "arts; the difference between training and fighting."),
    ],

    "phrase-arts-cinema-and-film": [
        ("genres & their pleasures",
         "Westerns, noir, romantic comedy, horror, sci-fi, animation; "
         "what each genre asks of an audience."),
        ("directors & the auteur tradition",
         "Hitchcock, Kurosawa, Scorsese, the Coens, Bong, Varda; the "
         "fingerprint a director leaves; the long careers."),
        ("actors & the craft of acting",
         "Stage versus screen, the close-up, character work, classic "
         "performances; the actor's preparation."),
        ("the audience experience",
         "The dark room, the popcorn, the multiplex, the art house, the "
         "midnight movie; watching at home versus the cinema."),
        ("technique: camera, editing, sound",
         "The shot, the cut, the score, the sound design; what the craft "
         "behind the curtain is doing; the title sequence."),
    ],

    "phrase-life-the-night": [
        ("sleep & dreams",
         "Falling asleep, sleep stages, dreams, REM, vivid dreams, lucid "
         "dreams, the morning's recall."),
        ("insomnia & the wakeful hours",
         "The hour you cannot sleep, the kitchen at 3 AM, sleep hygiene, "
         "the slow worry-loop, herbal tea, melatonin."),
        ("the night shift & late workers",
         "Nurses, drivers, bakers, security guards, journalists; the "
         "rhythm of working when the city sleeps."),
        ("the city at night",
         "Streetlights, late buses, all-night diners, taxi drivers, the "
         "rare quiet of a city emptied of crowds."),
        ("dawn & the slow return",
         "The hour before sunrise, the first birds, dew, the first bakery "
         "lights, the long-awaited morning."),
    ],

    "phrase-life-camping-basics": [
        ("gear & packing",
         "Tents, sleeping bags, stoves, headlamps, the bag you carry in; "
         "what to bring and what to leave."),
        ("setting up camp",
         "Choosing a site, pitching the tent, hanging food, fire ring; the "
         "small daily rituals of a base camp."),
        ("fire, cooking, & water",
         "Building a fire, camp stoves, water purification, cooking over "
         "coals, dishes in a stream."),
        ("weather, navigation, & safety",
         "Reading the sky, map and compass, what to do in a storm, animal "
         "safety, the first aid kit."),
        ("nights outside & camp life",
         "Stars, conversation around the fire, sleeping in a tent, the "
         "small hours, waking up cold; what camping returns to a person."),
    ],

    "phrase-vehicles-cars-and-driving": [
        ("the engine & mechanics",
         "What's under the hood, oil changes, brakes, batteries, the "
         "mechanic's bay; learning what's wrong by the sound."),
        ("driving skills & city traffic",
         "Parallel parking, merging, lane changes, four-way stops, "
         "rush-hour patience; the small daily lessons of the road."),
        ("the road trip",
         "Long highways, gas stations, motels, road snacks, the playlist; "
         "the romance of driving cross-country."),
        ("car culture & ownership",
         "First cars, used cars, restoration, classic cars, dealerships; "
         "the long relationship between owner and machine."),
        ("electric, autonomous, & the future",
         "EVs, charging, hybrid driving, autonomous tech, the changing "
         "shape of what a car is."),
    ],

    "phrase-botany-basics": [
        ("plant anatomy & growth",
         "Roots, stems, leaves, flowers, seeds; photosynthesis, "
         "transpiration; how a plant lives."),
        ("flowers & pollination",
         "Petals, pistils, bees, hummingbirds, the small machinery of "
         "fertilization; the year's flowering calendar."),
        ("trees & forests",
         "Oaks, pines, maples, the canopy, the understory; what a forest "
         "is; the long lives of trees."),
        ("the garden & cultivation",
         "Vegetables, herbs, perennials, raised beds, compost; the "
         "amateur gardener's seasons."),
        ("wild plants & ecology",
         "Wildflowers, weeds, ferns, mosses, lichens; native versus "
         "invasive; the small wild places."),
    ],

    "phrase-geology-basics": [
        ("rocks & minerals",
         "Igneous, sedimentary, metamorphic; granite, basalt, sandstone; "
         "the names of the common stones underfoot."),
        ("plate tectonics & earthquakes",
         "Continental drift, subduction, faults, volcanoes, the slow "
         "rearrangement of continents."),
        ("the work of water & ice",
         "Rivers cutting canyons, glaciers, erosion, sediment, the "
         "shaping of valleys over geologic time."),
        ("fossils & deep time",
         "Trilobites, ammonites, dinosaurs, the geologic column; what "
         "rock layers remember."),
        ("mountains, deserts, & landscapes",
         "How the great landscapes form; the Himalayas, the Andes, the "
         "Grand Canyon; reading a landscape's history."),
    ],

    "phrase-tech-computers-basics": [
        ("the device itself",
         "Laptops, desktops, tablets, monitors, keyboards, the small "
         "physical care of hardware."),
        ("files & the file system",
         "Folders, naming, search, cloud storage, backups; the daily work "
         "of keeping documents found."),
        ("the internet & the browser",
         "Tabs, bookmarks, downloads, the address bar, search engines, "
         "the modern web."),
        ("apps, accounts, & passwords",
         "Logging in, two-factor, password managers, the modern bureaucracy "
         "of digital identity."),
        ("everyday troubleshooting",
         "Restart, update, reset, the IT-helpdesk script; small fixes for "
         "common annoyances."),
    ],

    "phrase-travel-essentials": [
        ("hotels & lodging",
         "Check-in, check-out, room types, the front desk, hostels, "
         "Airbnb; the small dance of arriving somewhere."),
        ("airports, trains, & getting around",
         "Boarding passes, gates, customs, taxis, metros; the questions "
         "you ask in transit."),
        ("restaurants & ordering food",
         "Menus, allergies, dietary needs, tipping, the small phrases of "
         "eating in a new country."),
        ("emergencies & asking for help",
         "Pharmacy, hospital, lost passport, embassy, the police; "
         "vocabulary for when something goes wrong."),
        ("shopping, money, & small talk",
         "Currency, markets, bargaining, asking directions, polite "
         "phrases for everyday encounters."),
    ],

    "phrase-humanities-economics-basics": [
        ("money & personal finance",
         "Savings, debt, credit, mortgages, taxes; the household balance "
         "sheet; the small daily money decisions."),
        ("work, wages, & jobs",
         "Salaries, hourly work, gig economy, unemployment, retirement; "
         "the labor side of the economy."),
        ("markets, prices, & trade",
         "Supply and demand, inflation, scarcity, why prices move, "
         "international trade in plain terms."),
        ("business & entrepreneurship",
         "Starting a company, customers, costs, profits, competition; "
         "the small-business view."),
        ("the big picture: GDP, growth, recession",
         "Macroeconomic ideas in plain language; recessions, central "
         "banks, fiscal policy; the long economy."),
    ],

    "phrase-work-office-basics": [
        ("meetings & calendars",
         "Scheduling, agendas, video calls, conference rooms, the small "
         "etiquette of corporate time."),
        ("email & written communication",
         "Subject lines, replies-all, professional tone, signatures; the "
         "long inbox of modern work."),
        ("colleagues, managers, & teams",
         "Standups, one-on-ones, feedback, performance reviews; the "
         "social architecture of the workplace."),
        ("projects, deadlines, & deliverables",
         "Planning, ticketing, retrospectives, status updates; the "
         "rhythm of getting things done at work."),
        ("the rest of work: lunch, breaks, hybrid life",
         "Lunch, the office kitchen, remote days, the commute, "
         "after-work drinks; the human edges of the workday."),
    ],

    # ====================== DEEP (8 facets, 800-target) ======================

    "phrase-humanities-philosophy-basics": [
        ("metaphysics & first questions",
         "Being, existence, why anything is, the nature of time; the "
         "ancient first puzzles."),
        ("epistemology: knowledge & doubt",
         "How we know what we know; skepticism, Descartes, perception, "
         "the limits of certainty."),
        ("ethics & the good life",
         "Aristotle's virtues, utilitarianism, Kant, modern ethics; "
         "everyday moral reasoning."),
        ("philosophy of mind & consciousness",
         "Mind-body problem, qualia, AI, dualism, the hard problem; what "
         "thinking is."),
        ("political philosophy & justice",
         "Plato, Hobbes, Locke, Rousseau, Rawls; freedom, equality, "
         "the social contract."),
        ("Eastern philosophy & non-Western traditions",
         "Confucius, Buddhism, Daoism, Indian philosophy, Sufism; the "
         "comparative reader's respectful attention."),
        ("20th-century & modern philosophy",
         "Existentialism, phenomenology, analytic philosophy, Wittgenstein, "
         "Foucault, the linguistic turn."),
        ("the philosophical life",
         "Reading, dialogue, doubt, the examined life; what it is to live "
         "philosophically without lecturing."),
    ],

    "phrase-learning": [
        ("curiosity & beginnings",
         "First questions, beginner's mind, the spark of wanting to know; "
         "what gets someone started."),
        ("practice & deliberate work",
         "Drills, hours, the patient repetition; deliberate practice; "
         "the long unglamorous middle of any skill."),
        ("mentors, teachers, & traditions",
         "The great teacher, the master-apprentice relationship, lineages, "
         "the gift of being taught."),
        ("childhood & how children learn",
         "First words, school, the small wonders, the difference between "
         "how a child and an adult learn."),
        ("self-teaching & autodidacts",
         "Books, courses, YouTube, the lonely pleasure of teaching "
         "yourself a hard thing."),
        ("language learning",
         "Hearing, mimicking, grammar, immersion, the long slope of "
         "becoming fluent in a foreign tongue."),
        ("memory, attention, & the inner work",
         "How to study, spaced repetition, focus, what to do with what "
         "you've learned; the inner discipline."),
        ("the long arc & lifelong learning",
         "Plateaus, breakthroughs, the slow accumulation of mastery; "
         "what it is to remain a student through a life."),
    ],

    "phrase-humanities-mythology-world": [
        ("Greek & Roman mythology",
         "The Olympians, the heroes, the tragic cycle; Homer, Hesiod, "
         "Ovid; what the Greeks bequeathed."),
        ("Norse & Germanic mythology",
         "Odin, Thor, Loki, Ragnarok, the nine worlds; the long winter "
         "imagination."),
        ("Hindu & South Asian mythology",
         "Vishnu, Shiva, Krishna, the Mahabharata, the Ramayana; the "
         "vast pantheon and its stories."),
        ("Chinese & East Asian mythology",
         "The Monkey King, Nu Wa, Chang'e, the eight immortals; Japanese "
         "kami, Korean myth."),
        ("Mesoamerican & South American mythology",
         "Quetzalcoatl, the Hero Twins of the Popol Vuh, Inca cosmology; "
         "the maize-cultures' long stories."),
        ("African & diaspora mythologies",
         "Yoruba orishas (Ogun, Yemoja, Shango), Anansi, Egyptian gods, "
         "the journeys these stories took."),
        ("Polynesian, Aboriginal, & oceanic mythologies",
         "Maui, Pele, Dreamtime, the seafaring peoples' cosmologies."),
        ("comparative mythology & the structure of myth",
         "The hero's journey, the flood story, the trickster; what "
         "different traditions agree on and disagree about."),
    ],

    "phrase-life-family-and-friends": [
        ("parents & children",
         "The first relationship; what parents do; what children learn "
         "from how they were raised."),
        ("siblings & cousins",
         "The lateral kin relationships; rivalries, alliances, the "
         "shared childhood; the cousins one rarely sees."),
        ("grandparents & the older generation",
         "What grandparents bring; the long memory in the family; "
         "the gift of being known across decades."),
        ("partners & marriage",
         "Falling in love, getting married, the long partnership; how "
         "two people build a shared life."),
        ("in-laws & extended family",
         "The family you marry into; awkward holidays; the slow welcome "
         "across blood lines."),
        ("friendships across a lifetime",
         "Childhood friends, college friends, work friends; the friends "
         "you keep and the ones you drift from."),
        ("family meals, holidays, & rituals",
         "Sunday dinner, birthdays, the small rituals that hold a "
         "household together."),
        ("grief, distance, & repair",
         "The death of a parent, fights, estrangement, the work of "
         "mending; what families endure."),
    ],

    "phrase-life-cooking-basics": [
        ("knives, pots, & the working kitchen",
         "Tools, knife skills, mise en place, the kitchen as workshop; "
         "the small daily setup."),
        ("eggs, rice, & the daily staples",
         "What a home cook makes on a Tuesday; eggs, rice, beans, pasta, "
         "the small reliable suppers."),
        ("vegetables, fruits, & the farmer's market",
         "Seasonal produce, the green grocer, the small art of choosing "
         "ripe; soups, salads, sides."),
        ("meat, fish, & protein",
         "Roasting, braising, grilling, frying; whole chickens, fillets, "
         "the cook's respect for an ingredient."),
        ("baking, bread, & sweets",
         "Flour, yeast, butter, sugar; the bakers' patience; cookies, "
         "cakes, the home loaf."),
        ("spices, herbs, & global flavors",
         "Cumin, basil, fish sauce, miso; how a kitchen learns from "
         "other kitchens around the world."),
        ("hosting, feasts, & meals shared",
         "Dinner parties, potlucks, holidays; the cook as host; "
         "the long table."),
        ("food, memory, & the cook's voice",
         "Mom's recipe, grandma's kitchen; how a cuisine becomes home; "
         "the food we cook because someone we loved cooked it."),
    ],

    "phrase-arts-music-fundamentals": [
        ("notes, scales, & the basics of theory",
         "Pitches, octaves, scales, intervals; the alphabet of music in "
         "plain language."),
        ("rhythm, meter, & feel",
         "Beats, bars, time signatures, swing, groove; what makes music "
         "move."),
        ("instruments of the orchestra & beyond",
         "Strings, winds, brass, percussion; piano, guitar, drums; the "
         "voices each instrument has."),
        ("composers & the classical tradition",
         "Bach, Mozart, Beethoven, Debussy, Stravinsky; what the great "
         "tradition asks of a listener."),
        ("jazz, blues, & American music",
         "Blue notes, swing, bebop, Coltrane, Ellington; the long "
         "American improvisational tradition."),
        ("rock, pop, & popular music",
         "Beatles, Dylan, hip-hop, electronic music; the popular music "
         "of the last seventy years."),
        ("world music & non-Western traditions",
         "Indian classical, West African drumming, gamelan, qawwali; "
         "the planet's many musics."),
        ("the practice of music: lessons, performance, listening",
         "Learning an instrument, recitals, the concert hall, the long "
         "education of an ear."),
    ],

    "phrase-nature-the-ocean": [
        ("waves, tides, & the surface",
         "Surf, swell, tide cycles, the look and sound of the surface; "
         "the rhythm of the sea you can see from shore."),
        ("marine life",
         "Fish, whales, dolphins, octopus, coral; the food web; what "
         "lives in the sea."),
        ("sailing, boats, & seamanship",
         "Sailboats, harbors, knots, the language of going to sea; the "
         "captain's small daily decisions."),
        ("beaches, coasts, & tidepools",
         "Sand, dunes, lighthouses, beachcombing, summer; the meeting "
         "edge of land and water."),
        ("storms, weather, & danger at sea",
         "Hurricanes, fog, gales, gulls; the ocean in foul weather; the "
         "fisherman's respect for the sky."),
        ("the deep & the dark",
         "Trenches, bioluminescence, the abyssal plain, hydrothermal "
         "vents; what we cannot see."),
        ("the sea in human imagination",
         "Sailors' songs, Moby-Dick, ports, the harbor town; what the "
         "sea has meant to people who lived beside it."),
        ("conservation, climate, & change",
         "Plastic, warming, acidification, coral bleaching, fisheries; "
         "what one ocean shares with the next."),
    ],

    "phrase-places-geography-world": [
        ("continents & the great landmasses",
         "The shape of each continent; the broad strokes of where the "
         "world's people live."),
        ("countries, capitals, & borders",
         "Naming countries, capital cities, the political map; how "
         "borders shift and stay."),
        ("cities & urban life",
         "The great cities, megacities, small towns; what cities do; "
         "neighborhoods within cities."),
        ("rivers, lakes, & freshwater",
         "The Nile, Amazon, Mississippi, Ganges; rivers as borders, "
         "highways, and lifeblood."),
        ("mountains, deserts, & landscapes",
         "The Himalayas, the Sahara, the Andes; how the landforms shape "
         "the cultures they hold."),
        ("climate, biomes, & weather patterns",
         "Tropical, temperate, polar; rainforests, tundra; how climate "
         "draws the human map."),
        ("migration, language, & cultural geography",
         "Diasporas, language families, religions across borders; the "
         "human dimension of geography."),
        ("travel, exploration, & the maker's map",
         "Cartography, exploration, modern travel; how the map of the "
         "world has been drawn and redrawn."),
    ],

    "phrase-life-festivals-world": [
        ("Diwali, Holi, & South Asian festivals",
         "Light, color, the new year, sweets; the long Indian festival "
         "calendar."),
        ("Lunar New Year & East Asian festivals",
         "Chinese New Year, Mid-Autumn, Songkran, Korean and Japanese "
         "festivals; the lunar calendar's celebrations."),
        ("Christmas, Easter, & Christian festivals",
         "The Christian calendar; Advent, Epiphany, Pentecost; the long "
         "European-Christian festival tradition."),
        ("Ramadan, Eid, & Muslim festivals",
         "Fasting, iftar, Eid al-Fitr, Eid al-Adha; the rhythm of the "
         "Islamic year."),
        ("Hanukkah, Passover, & Jewish festivals",
         "The Jewish calendar; Yom Kippur, Sukkot, Rosh Hashanah, the "
         "long Jewish year."),
        ("Day of the Dead, Carnival, & Latin American festivals",
         "Día de los Muertos, Carnaval, Mardi Gras, Las Posadas; the "
         "color and grief of the Latin calendar."),
        ("Nowruz, Songkran, & spring festivals",
         "The world's spring rituals; Persian Nowruz, Thai Songkran, "
         "May Day, the calendars that mark the warming."),
        ("birthdays, weddings, & life-cycle celebrations",
         "Quinceañeras, bar mitzvahs, weddings, funerals; the private "
         "festivals that mark a single life."),
    ],

    "phrase-life-health-and-body": [
        ("the body & its systems",
         "Bones, muscles, organs, the heart, the brain; basic anatomy "
         "in plain words."),
        ("doctors, clinics, & medicine",
         "Check-ups, prescriptions, hospitals, specialists; the modern "
         "medical encounter."),
        ("exercise, fitness, & movement",
         "Walking, running, lifting, yoga, swimming; the small daily "
         "discipline of moving the body."),
        ("food, nutrition, & eating",
         "What we eat, allergies, diets, the long human relationship "
         "with food and health."),
        ("sleep, rest, & recovery",
         "Sleep hygiene, naps, jet lag, recovery from illness; the "
         "underrated repair of the body."),
        ("mental health & emotional wellbeing",
         "Anxiety, depression, therapy, friendship as health, mood; "
         "warm, practical, not preachy."),
        ("chronic illness, aging, & long-term care",
         "Diabetes, arthritis, heart disease, dementia; the long "
         "experience of bodies that change."),
        ("public health, prevention, & community",
         "Vaccines, sanitation, smoking, exercise as policy; the health "
         "of populations, not just individuals."),
    ],
}


def get_tier(pack_id: str) -> str:
    return TIER.get(pack_id, "WIDE")


def get_facets(pack_id: str) -> list[tuple[str, str]]:
    return FACETS.get(pack_id, [])


def get_target_total(pack_id: str) -> int:
    return 800 if TIER.get(pack_id) == "DEEP" else 500


# Canonical level-shape per tier
CANONICAL_SHAPE = {
    "WIDE": {"A0": 5,  "A1": 75,  "A2": 175, "B1": 90,  "B2": 75,  "C1": 60,  "C2": 25},   # 505
    "DEEP": {"A0": 8,  "A1": 120, "A2": 280, "B1": 145, "B2": 120, "C1": 95,  "C2": 40},   # 808
}


if __name__ == "__main__":
    # Sanity check: every pack has the right number of facets
    from collections import Counter
    counts = Counter(TIER.values())
    print(f"DEEP packs: {counts['DEEP']} (expected 10)")
    print(f"WIDE packs: {counts['WIDE']} (expected 14)")
    print(f"Total: {sum(counts.values())} (expected 24)")
    print()
    for pid, tier in TIER.items():
        expected = 8 if tier == "DEEP" else 5
        actual = len(FACETS.get(pid, []))
        marker = "OK" if actual == expected else f"MISMATCH (got {actual}, expected {expected})"
        print(f"  {pid:<45} {tier}  {actual} facets  {marker}")
