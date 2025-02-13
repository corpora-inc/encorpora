#!/bin/bash

set -e

files=(
    "00-00-00-unit-intro-foundations-of-history.md"
    "00-01-00-chapter-intro-what-is-history.md"
    "00-01-01-section-the-purpose-of-studying-history-and-its-role-in-society.md"
    "00-01-02-section-how-historical-narratives-are-shaped-by-culture-politics-and-power.md"
    "00-01-03-section-history-as-propaganda-how-the-victors-write-their-own-accounts.md"
    "00-01-04-section-how-our-understanding-of-the-past-evolves-with-new-evidence-and-perspectives.md"
    "00-01-05-section-how-this-book-was-written-the-challenges-of-historical-research-and-why-critical-thinking-is-essential.md"
    "00-02-00-chapter-intro-how-historians-study-the-past.md"
    "00-02-01-section-primary-vs-secondary-sources-how-historians-evaluate-evidence.md"
    "00-02-02-section-archaeology-and-learning-from-ruins-what-artifacts-tell-us-about-the-past.md"
    "00-02-03-section-modern-scientific-methods-in-historical-research-carbon-dating-dna-analysis-and-forensics.md"
    "00-02-04-section-fragility-of-historical-records-how-wars-weather-and-time-have-erased-much-of-the-past.md"
    "00-03-00-chapter-intro-how-time-and-history-are-measured.md"
    "00-03-01-section-bce-vs-ce-how-different-cultures-define-and-measure-historical-time.md"
    "00-03-02-section-different-calendars-throughout-history-the-julian-gregorian-islamic-and-chinese-calendars.md"
    "00-03-03-section-the-evolution-of-timekeeping-from-sundials-and-water-clocks-to-atomic-time.md"
    "00-03-04-section-misdated-events-and-the-fomenko-alternative-chronology-rewriting-history-with-radical-theories.md"
    "00-03-05-section-the-debate-over-the-dark-ages-and-missing-centuries-did-historical-forgeries-create-false-gaps-in-time.md"
    "00-04-00-chapter-intro-the-many-versions-of-history-around-the-world.md"
    "00-04-01-section-how-different-countries-teach-history-china-russia-the-us-and-other-nations-interpret-the-past-differently.md"
    "00-04-02-section-putins-russia-vs-western-historical-interpretations-rewriting-the-past-to-control-the-present.md"
    "00-04-03-section-how-world-war-ii-is-taught-differently-in-the-us-japan-germany-and-russia-national-memory-and-war-narratives.md"
    "00-04-04-section-historical-memory-and-the-israeli-palestinian-conflict-how-two-nations-remember-the-same-events-differently.md"
    "00-04-05-section-the-inevitability-of-bias-in-history-and-why-critical-thinking-is-essential-to-understanding-the-past.md"
    "01-00-00-unit-intro-the-dawn-of-humanity.md"
    "01-01-00-chapter-intro-the-origins-of-humans-and-the-pre-human-world.md"
    "01-01-01-section-the-formation-of-earth-and-the-world-before-humans.md"
    "01-01-02-section-the-rise-of-mammals-and-the-first-primates.md"
    "01-01-03-section-the-great-apes-and-the-human-ancestral-line.md"
    "01-01-04-section-the-evolution-of-humans-what-we-know-and-what-we-dont.md"
    "01-02-00-chapter-intro-human-evolution-and-the-first-hominins.md"
    "01-02-01-section-africa-as-the-birthplace-of-humans-the-evidence-and-controversies.md"
    "01-02-02-section-homo-erectus-and-the-first-migrations-out-of-africa.md"
    "01-02-03-section-who-were-the-neanderthals-and-why-did-they-go-extinct.md"
    "01-02-04-section-the-discovery-of-fire-and-how-it-transformed-humanity.md"
    "01-02-05-section-the-mystery-of-denisovans-an-unknown-human-cousin.md"
    "01-02-06-section-did-other-human-species-exist-that-we-havent-found-yet.md"
    "01-02-07-section-how-human-skin-color-evolved-and-adapted-to-climate.md"
    "01-03-00-chapter-intro-the-hunter-gatherers.md"
    "01-03-01-section-how-early-humans-lived-before-agriculture-nomadic-lifestyle-and-survival-strategies.md"
    "01-03-02-section-the-first-tools-and-the-technology-of-prehistoric-humans.md"
    "01-03-03-section-how-early-humans-hunted-and-gathered-food-strategies-and-adaptations.md"
    "01-03-04-section-the-ice-age-and-how-it-shaped-human-migration-and-settlement-patterns.md"
    "01-03-05-section-when-and-how-did-humans-first-arrive-in-the-americas-theories-and-debates.md"
    "01-03-06-section-the-first-artists-cave-paintings-symbols-and-music-as-early-culture.md"
    "01-03-07-section-the-first-burials-and-early-beliefs-about-death-afterlife-and-rituals.md"
    "01-04-00-chapter-intro-the-agricultural-revolution.md"
    "01-04-01-section-why-humans-started-farming-theories-and-evidence.md"
    "01-04-02-section-how-agriculture-led-to-permanent-settlements-and-social-complexity.md"
    "01-04-03-section-the-domestication-of-animals-and-the-birth-of-pastoralism.md"
    "01-04-04-section-early-farming-societies-around-the-world-different-paths-to-agriculture.md"
    "01-04-05-section-the-social-impact-of-agriculture-inequality-war-and-class-divisions.md"
    "01-04-06-section-the-invention-of-writing-and-early-record-keeping-in-agrarian-societies.md"
    "01-04-07-section-how-trade-and-early-money-systems-developed-in-farming-communities.md"
    "01-05-00-chapter-intro-early-religion-and-spirituality.md"
    "01-05-01-section-did-hunter-gatherers-have-gods-the-origins-of-religious-belief.md"
    "01-05-02-section-the-role-of-shamans-and-rituals-in-early-human-societies.md"
    "01-05-03-section-the-earliest-temples-and-sacred-sites-like-gobekli-tepe-and-their-meaning.md"
    "01-06-00-chapter-intro-the-role-of-women-in-early-societies.md"
    "01-06-01-section-was-prehistoric-society-matriarchal-or-patriarchal-why-we-dont-know.md"
    "01-06-02-section-womens-roles-in-agriculture-religion-and-early-economies.md"
    "01-06-03-section-how-gender-roles-changed-with-the-rise-of-agriculture-and-civilization.md"
    "01-07-00-chapter-intro-the-long-road-to-civilization.md"
    "01-07-01-section-how-some-societies-became-advanced-faster-than-others-geography-and-resources.md"
    "01-07-02-section-why-didnt-some-hunter-gatherers-adopt-agriculture-the-case-of-persistent-nomads.md"
    "01-07-03-section-how-climate-changes-shaped-early-human-migration-and-cultural-adaptation.md"
    "01-07-04-section-theories-about-lost-civilizations-before-ancient-history.md"
    "02-00-00-unit-intro-the-rise-of-civilizations.md"
    "02-01-00-chapter-intro-what-makes-a-civilization.md"
    "02-01-01-section-the-key-traits-of-a-civilization-government-trade-writing-and-religion.md"
    "02-01-02-section-the-bronze-age-and-the-emergence-of-early-states.md"
    "02-01-03-section-the-invention-of-writing-and-how-it-transformed-society.md"
    "02-01-04-section-the-first-trade-networks-and-the-rise-of-early-economies.md"
    "02-01-05-section-the-role-of-religion-and-mythology-in-early-civilizations.md"
    "02-02-00-chapter-intro-mesopotamian-civilization.md"
    "02-02-01-section-the-sumerians-and-the-first-cities-in-human-history.md"
    "02-02-02-section-cuneiform-the-first-writing-system-and-its-impact.md"
    "02-02-03-section-the-code-of-hammurabi-and-the-origins-of-law.md"
    "02-02-04-section-the-rise-and-fall-of-babylon-and-assyria.md"
    "02-02-05-section-ziggurats-mesopotamian-religion-and-their-view-of-the-gods.md"
    "02-02-06-section-the-importance-of-rivers-tigris-and-euphrates-in-mesopotamian-life.md"
    "02-02-07-section-early-warfare-and-conflicts-between-mesopotamian-city-states.md"
    "02-03-00-chapter-intro-ancient-egypt-and-nubia.md"
    "02-03-01-section-the-pharaohs-and-divine-rule-over-egyptian-society.md"
    "02-03-02-section-the-building-of-the-great-pyramids-and-monuments.md"
    "02-03-03-section-hieroglyphics-and-the-importance-of-writing-in-egypt.md"
    "02-03-04-section-the-role-of-the-nile-river-in-egyptian-society-and-economy.md"
    "02-03-05-section-religion-and-the-afterlife-mummies-and-elaborate-tombs.md"
    "02-03-06-section-the-old-middle-and-new-kingdoms-of-egypt-and-their-differences.md"
    "02-03-07-section-ancient-nubia-its-culture-trade-and-war-with-egypt.md"
    "02-04-00-chapter-intro-the-indus-valley-civilization.md"
    "02-04-01-section-the-mysterious-cities-of-harappa-and-mohenjo-daro.md"
    "02-04-02-section-early-drainage-systems-and-advanced-city-planning.md"
    "02-04-03-section-the-possible-writing-system-of-the-indus-valley-and-the-lost-script.md"
    "02-04-04-section-how-the-indus-valley-civilization-vanished-theories-and-evidence.md"
    "02-04-05-section-theories-on-the-indo-aryan-migration-and-its-impact-on-india.md"
    "02-05-00-chapter-intro-ancient-china-the-shang-and-zhou-dynasties.md"
    "02-05-01-section-the-oracle-bones-and-the-beginning-of-chinese-writing.md"
    "02-05-02-section-the-zhou-dynasty-and-the-mandate-of-heaven.md"
    "02-05-03-section-early-chinese-technologies-bronze-silk-and-irrigation.md"
    "02-05-04-section-the-warring-states-period-and-the-rise-of-the-qin-dynasty.md"
    "02-06-00-chapter-intro-the-early-jewish-people-and-their-place-in-the-ancient-world.md"
    "02-06-01-section-the-origins-of-the-hebrew-people-and-their-semitic-roots.md"
    "02-06-02-section-the-patriarchs-abraham-isaac-and-jacob.md"
    "02-06-03-section-their-relationship-with-egypt-assyria-and-babylon.md"
    "02-06-04-section-the-early-kingdoms-of-israel-and-judah.md"
    "02-06-05-section-the-babylonian-captivity-and-the-destruction-of-the-first-temple.md"
    "02-06-06-section-the-babylonian-exile-life-in-babylon-and-the-evolution-of-jewish-identity.md"
    "02-06-07-section-the-persian-conquest-of-babylon-and-the-return-to-jerusalem.md"
    "02-07-00-chapter-intro-early-civilizations-of-africa.md"
    "02-07-01-section-the-kingdom-of-kush-and-its-war-with-egypt.md"
    "02-07-02-section-the-nok-culture-and-the-earliest-use-of-iron-in-west-africa.md"
    "02-07-03-section-the-ancient-city-of-djenne-djenno-and-the-trans-saharan-trade.md"
    "02-07-04-section-the-garamantes-and-the-lost-civilization-of-the-sahara.md"
    "02-08-00-chapter-intro-early-civilizations-of-the-pacific.md"
    "02-08-01-section-the-first-humans-to-reach-australia-and-aboriginal-culture.md"
    "02-08-02-section-the-lapita-people-and-their-expansion-across-the-pacific.md"
    "02-08-03-section-navigation-and-early-boats-of-the-polynesians.md"
    "02-08-04-section-early-rituals-and-religious-practices-in-oceania.md"
    "02-09-00-chapter-intro-early-civilizations-of-the-americas.md"
    "02-09-01-section-the-caral-supe-and-norte-chico-civilizations.md"
    "02-09-02-section-the-chavin-culture-and-early-andean-societies.md"
    "02-09-03-section-the-olmecs-the-mother-culture-of-mesoamerica.md"
    "02-09-04-section-the-maya-emerge-the-first-city-states-in-central-america.md"
    "02-10-00-chapter-intro-early-civilizations-of-northern-europe.md"
    "02-10-01-section-the-peoples-of-prehistoric-europe-and-their-migrations.md"
    "02-10-02-section-cave-art-and-early-settlements-in-europe-altamira-lascaux.md"
    "02-10-03-section-megalithic-monuments-stonehenge-and-other-sites.md"
    "02-10-04-section-the-first-farmers-in-europe-and-the-spread-of-agriculture.md"
    "02-10-05-section-the-bronze-age-cultures-of-northern-and-central-europe.md"
    "02-10-06-section-the-proto-indo-european-migrations-and-their-legacy.md"
    "02-11-00-chapter-intro-the-bronze-age-collapse-and-the-dark-age.md"
    "02-11-01-section-the-mysterious-collapse-of-mediterranean-civilizations.md"
    "02-11-02-section-the-sea-peoples-and-the-end-of-the-bronze-age.md"
    "02-11-03-section-how-the-collapse-of-trade-set-humanity-back-centuries.md"
    "02-11-04-section-the-rise-of-the-iron-age-and-the-next-era-of-history.md"
    "03-00-00-unit-intro-the-classical-era.md"
    "03-01-00-chapter-intro-the-persian-empire.md"
    "03-01-01-section-cyrus-the-great-and-the-creation-of-persia.md"
    "03-01-02-section-darius-the-great-and-the-royal-road.md"
    "03-01-03-section-the-greco-persian-wars-and-the-decline-of-persia.md"
    "03-01-04-section-the-administration-and-multiculturalism-of-the-persian-empire.md"
    "03-01-05-section-zoroastrianism-and-its-lasting-influence.md"
    "03-02-00-chapter-intro-ancient-india-and-the-maurya-gupta-empires.md"
    "03-02-01-section-ashoka-the-great-and-the-spread-of-buddhism.md"
    "03-02-02-section-science-and-mathematics-in-ancient-india-zero-decimals-astronomy.md"
    "03-02-03-section-the-gupta-golden-age-art-literature-and-trade.md"
    "03-02-04-section-hinduism-and-its-influence-on-indian-statecraft.md"
    "03-02-05-section-the-role-of-buddhism-in-shaping-asian-politics.md"
    "03-03-00-chapter-intro-ancient-china-the-qin-and-han-dynasties.md"
    "03-03-01-section-the-warring-states-period-and-the-unification-of-china.md"
    "03-03-02-section-legalism-and-the-rule-of-the-qin-emperor-shi-huangdi.md"
    "03-03-03-section-the-great-wall-and-military-strategy-of-china.md"
    "03-03-04-section-the-han-dynasty-and-the-first-chinese-golden-age.md"
    "03-03-05-section-early-scientific-and-technological-advancements-in-china.md"
    "03-03-06-section-the-silk-road-and-chinas-early-global-trade-influence.md"
    "03-04-00-chapter-intro-the-jewish-people-in-the-classical-era.md"
    "03-04-01-section-the-hasmonean-kingdom-and-the-maccabean-revolt.md"
    "03-04-02-section-roman-conquest-of-judea-and-the-rise-of-herod.md"
    "03-04-03-section-the-jewish-roman-wars-and-the-destruction-of-the-second-temple.md"
    "03-04-04-section-the-diaspora-and-the-birth-of-rabbinic-judaism.md"
    "03-04-05-section-how-jews-maintained-their-identity-under-roman-rule.md"
    "03-05-00-chapter-intro-ancient-africa-and-the-rise-of-black-african-kingdoms.md"
    "03-05-01-section-carthage-the-naval-power-of-the-mediterranean.md"
    "03-05-02-section-the-garamantes-of-the-sahara-the-lost-civilization-of-the-desert.md"
    "03-05-03-section-the-kingdom-of-kush-and-its-war-with-egypt-and-rome.md"
    "03-05-04-section-the-nok-culture-and-the-earliest-use-of-iron-in-west-africa.md"
    "03-05-05-section-the-bantu-expansion-and-the-spread-of-languages-and-iron-working.md"
    "03-05-06-section-ancient-trade-networks-between-africa-and-the-wider-world.md"
    "03-06-00-chapter-intro-ancient-greece.md"
    "03-06-01-section-the-rise-of-the-polis-and-the-structure-of-greek-city-states.md"
    "03-06-02-section-athens-and-the-birth-of-democracy.md"
    "03-06-03-section-sparta-and-the-warrior-society.md"
    "03-06-04-section-the-persian-wars-and-the-rise-of-the-delian-league.md"
    "03-06-05-section-the-philosophers-socrates-plato-aristotle.md"
    "03-06-06-section-the-peloponnesian-war-and-the-decline-of-greek-power.md"
    "03-06-07-section-the-conquests-of-alexander-the-great.md"
    "03-06-08-section-the-hellenistic-world-and-the-blending-of-cultures.md"
    "03-07-00-chapter-intro-ancient-rome-from-republic-to-empire.md"
    "03-07-01-section-the-roman-republic-and-the-senate.md"
    "03-07-02-section-the-punic-wars-and-romans-vs-carthaginians.md"
    "03-07-03-section-julius-caesar-and-the-end-of-the-republic.md"
    "03-07-04-section-roman-law-and-its-influence-on-modern-legal-systems.md"
    "03-07-05-section-roman-architecture-and-engineering-aqueducts-colosseums-roads.md"
    "03-07-06-section-the-transition-from-republic-to-empire-augustus-and-the-pax-romana.md"
    "03-08-00-chapter-intro-the-roman-empire.md"
    "03-08-01-section-how-rome-became-an-empire-and-the-age-of-the-caesars.md"
    "03-08-02-section-daily-life-in-the-roman-empire-society-and-class-structure.md"
    "03-08-03-section-the-silk-road-and-trade-between-rome-and-asia.md"
    "03-08-04-section-the-rise-of-christianity-and-persecutions.md"
    "03-08-05-section-the-council-of-nicea-and-the-officialization-of-christianity.md"
    "03-08-06-section-the-decline-of-the-roman-empire-economic-and-military-collapse.md"
    "03-08-07-section-the-fall-of-rome-and-the-lasting-legacy-of-the-roman-world.md"
    "03-09-00-chapter-intro-the-americas-in-the-classical-era.md"
    "03-09-01-section-the-rise-of-the-maya-and-their-city-states.md"
    "03-09-02-section-the-olmecs-the-mother-culture-of-mesoamerica.md"
    "03-09-03-section-the-nazca-civilization-and-their-mysterious-lines.md"
    "03-09-04-section-the-moche-culture-and-their-irrigation-systems.md"
    "03-09-05-section-the-andean-civilizations-and-their-complex-societies.md"
    "03-10-00-chapter-intro-the-rise-of-powerful-migrations-and-barbarian-tribes.md"
    "03-10-01-section-the-huns-and-the-collapse-of-the-western-roman-empire.md"
    "03-10-02-section-how-the-hun-invasions-triggered-the-great-migrations.md"
    "03-10-03-section-the-germanic-tribes-and-their-role-in-reshaping-europe.md"
    "03-10-04-section-the-rise-of-the-sassanid-empire-and-the-war-with-rome.md"
    "03-11-00-chapter-intro-southeast-asia-in-the-classical-world.md"
    "03-11-01-section-the-rise-of-the-funan-and-champa-kingdoms.md"
    "03-11-02-section-the-influence-of-indian-trade-and-hinduism-in-sea.md"
    "03-11-03-section-early-buddhist-monarchies-and-temple-construction.md"
    "03-11-04-section-the-roots-of-khmer-civilization-and-the-beginnings-of-angkor.md"
    "03-11-05-section-the-maritime-trading-empires-and-their-role-in-asian-commerce.md"
    "03-12-00-chapter-intro-asian-philosophy-and-religion.md"
    "03-12-01-section-hinduism-and-its-influence-on-indian-empires.md"
    "03-12-02-section-buddhism-and-its-expansion-across-asia.md"
    "03-12-03-section-confucianism-and-the-foundation-of-chinese-statecraft.md"
    "03-12-04-section-taoism-and-the-way-of-nature.md"
    "03-12-05-section-shintoism-and-the-spiritual-roots-of-japan.md"
    "03-13-00-chapter-intro-the-classical-foundations-of-korea-and-japan.md"
    "03-13-01-section-the-mythic-origins-of-korea-and-the-first-kingdoms.md"
    "03-13-02-section-the-early-history-of-japan-and-the-yayoi-kofun-periods.md"
    "03-13-03-section-the-hairy-ainu-and-their-place-in-early-japan.md"
    "03-13-04-section-how-korea-and-japan-absorbed-chinese-influences.md"
    "03-13-05-section-shamanism-ancestor-worship-and-early-korean-and-japanese-religion.md"
    "03-14-00-chapter-intro-the-classical-era-ends-and-the-world-transforms.md"
    "03-14-01-section-the-rise-of-the-byzantine-empire-and-the-continuation-of-rome.md"
    "03-14-02-section-the-fragmentation-of-western-europe-and-the-rise-of-germanic-kingdoms.md"
    "03-14-03-section-the-fall-of-the-sassanid-empire-and-the-changing-map-of-persia.md"
    "03-14-04-section-the-post-gupta-period-and-the-fragmentation-of-india.md"
    "03-14-05-section-china-after-the-han-the-three-kingdoms-and-sui-reunification.md"
    "03-14-06-section-how-the-korean-three-kingdoms-and-japan-began-unifying.md"
    "03-14-07-section-the-jewish-diaspora-in-the-post-roman-world.md"
    "03-14-08-section-pre-islamic-arabia-and-the-spread-of-monotheism.md"
    "03-14-09-section-african-transitions-the-decline-of-carthage-and-rise-of-new-kingdoms.md"
    "03-14-10-section-mesoamerica-and-the-mayan-classic-period-expansion.md"
    "03-14-11-section-the-andes-after-the-moche-new-kingdoms-in-south-america.md"
    "03-14-12-section-how-the-classical-world-shaped-the-medieval-and-modern-world.md"

    04-00-00-unit-intro-the-post-classical-world-and-the-forging-of-new-civilizations.md
    04-01-00-chapter-intro-the-byzantine-empire-and-eastern-christendom.md
    04-01-01-section-the-legacy-of-rome-and-the-birth-of-byzantium.md
    04-01-02-section-constantinople-the-city-between-worlds.md
    04-01-03-section-justinian-the-great-and-the-hagia-sophia.md
    04-01-04-section-the-orthodox-church-and-the-schism-with-rome.md
    04-01-05-section-the-fall-of-byzantium-and-the-rise-of-the-ottomans.md
    04-02-00-chapter-intro-the-rise-of-islam-and-the-caliphates.md
    04-02-01-section-muhammad-and-the-birth-of-islam.md
    04-02-02-section-the-rashidun-caliphate-and-early-muslim-expansion.md
    04-02-03-section-the-umayyads-and-the-spread-of-islam-to-spain-and-central-asia.md
    04-02-04-section-the-abbasids-and-the-flowering-of-islamic-culture.md
    04-02-05-section-islamic-science-medicine-and-architecture-in-the-golden-age.md
    04-02-06-section-trade-networks-and-the-importance-of-the-islamic-world.md
    04-03-00-chapter-intro-medieval-europe-and-the-shaping-of-nations.md
    04-03-01-section-the-collapse-of-rome-and-the-fracturing-of-western-europe.md
    04-03-02-section-the-rise-of-the-papacy-and-the-political-power-of-the-church.md
    04-03-03-section-the-merovingians-and-the-rise-of-francia.md
    04-03-04-section-charlemagne-and-the-holy-roman-empire.md
    04-03-05-section-the-viking-age-raiders-traders-and-settlers.md
    04-03-06-section-the-anglo-saxons-and-the-formation-of-england.md
    04-03-07-section-the-saxon-ottoian-revival-and-the-german-kingdoms.md
    04-03-08-section-the-feudal-system-and-the-structure-of-medieval-society.md
    04-03-09-section-medieval-technology-agriculture-castles-and-cities.md
    04-03-10-section-the-growth-of-languages-and-the-birth-of-national identities.md
    04-04-00-chapter-intro-the-crusades-and-the-crossroads-of-faith-and-war.md
    04-04-01-section-the-causes-of-the-crusades-and-the-call-of-pope-urban-ii.md
    04-04-02-section-the-first-crusade-and-the-conquest-of-jerusalem.md
    04-04-03-section-the-rise-of-saladin-and-the-recapture-of-the-holy-land.md
    04-04-04-section-the-fourth-crusade-and-the-sack-of-constantinople.md
    04-04-05-section-the-crusades-in-spain-and-the-reconquista.md
    04-04-06-section-the-impact-of-the-crusades-on-europe-and-the-middle-east.md
    04-05-00-chapter-intro-the-mongol-empire-and-their-impact-on-the-world.md
    04-05-01-section-genghis-khan-and-the-unification-of-the-mongols.md
    04-05-02-section-the-conquest-of-china-and-the-yuan-dynasty.md
    04-05-03-section-the-mongols-in-persia-and-the-destruction-of-baghdad.md
    04-05-04-section-the-golden-horde-and-the-mongol-rule-of-russia.md
    04-05-05-section-the-silk-road-and-the-pax-mongolica.md
    04-05-06-section-the-decline-of-the-mongol-empire-and-its-fracturing.md
    04-06-00-chapter-intro-the-african-kingdoms-and-trade-networks.md
    04-06-01-section-the-rise-of-ghana-and-the-gold-salt-trade.md
    04-06-02-section-mali-and-the-legendary-mansa-musa.md
    04-06-03-section-the-swainili-coast-and-the-indian-ocean-trade.md
    04-06-04-section-ethiopia-and-the-legacy-of-axum.md
    04-06-05-section-great-zimbabwe-and-the-mysteries-of-southern-africa.md
    04-06-06-section-the-bantu-expansion-and-the-spread-of-language-and-iron.md
    04-07-00-chapter-intro-india-and-the-rise-of-medieval-kingdoms.md
    04-07-01-section-the-chola-dynasty-and-the-maritime-trade-empire.md
    04-07-02-section-the-delhi-sultanate-and-the-turco-muslim-conquest-of-india.md
    04-07-03-section-hinduism-buddhism-and-the-spread-of-islam-in-india.md
    04-07-04-section-art-science-and-mathematics-in-medieval-india.md
    04-08-00-chapter-intro-china-the-tang-song-and-yuan-dynasties.md
    04-08-01-section-the-tang-dynasty-and-the-expansion-of-chinese-influence.md
    04-08-02-section-the-silk-road-and-chinas-connection-to-the-world.md
    04-08-03-section-the-song-dynasty-and-the-rise-of-neo-confucianism.md
    04-08-04-section-chinese-inventions-paper-gunpowder-printing-and-compass.md
    04-08-05-section-the-mongol-conquest-of-china-and-the-yuan-dynasty.md
    04-09-00-chapter-intro-japan-korea-and-the-rise-of-the-samurai.md
    04-09-01-section-the-heian-period-and-the-birth-of-japanese-culture.md
    04-09-02-section-the-rise-of-the-samurai-and-the-feudal-warrior-class.md
    04-09-03-section-the-mongol-invasions-and-the-kamikaze-typhoons.md
    04-09-04-section-korean-kingdoms-and-the-rise-of-joseon-dynasty.md
    04-09-05-section-the-cultural-exchanges-between-china-korea-and-japan.md
    04-10-00-chapter-intro-southeast-asia-maritime-trade-and-early-kingdoms.md
    04-10-01-section-the-khmer-empire-and-the-building-of-angkor-wat.md
    04-10-02-section-srivijaya-and-the-maritime-trade-network.md
    04-10-03-section-the-islamization-of-southeast-asia-and-the-spread-of-hinduism.md
    04-11-00-chapter-intro-the-rise-of-the-rus-and-eastern-european-kingdoms.md
    04-11-01-section-the-varangians-and-the-founding-of-kievan-rus.md
    04-11-02-section-the-mongols-in-russia-and-the-rise-of-moscow.md
    04-11-03-section-poland-lithuania-and-the-great-eastern-european-kingdoms.md
    04-11-04-section-the-teutonic-knights-and-the-northern-crusades.md
    04-12-00-chapter-intro-the-americas-the-maya-aztec-and-inca.md
    04-12-01-section-the-maya-and-their-advanced-astronomy-and-writing.md
    04-12-02-section-the-aztec-empire-and-their-complex-society.md
    04-12-03-section-the-inca-empire-and-their-mountain-kingdom.md
    04-12-04-section-trade-networks-and-cultural-exchange-in-the-americas.md
    04-13-00-chapter-intro-the-black-death-and-the-crises-of-the-14th-century.md
    04-13-01-section-the-origin-and-spread-of-the-black-death.md
    04-13-02-section-the-economic-and-social-collapse-in-europe.md
    04-13-03-section-the-mongol-collapse-and-the-end-of-the-pax-mongolica.md
    04-13-04-section-the-rise-of-the-ottoman-empire.md
    04-14-00-chapter-intro-the-end-of-the-post-classical-world-and-the-birth-of-globalization.md
    04-14-01-section-the-ming-dynasty-and-the-restoration-of-chinese-power.md
    04-14-02-section-the-renaissance-and-the-rebirth-of-europe.md
    04-14-03-section-the-rise-of-seafaring-kingdoms-portugal-and-spain.md
    04-14-04-section-how-the-post-classical-world-set-the-stage-for-modern-history.md



    "05-00-00-the-age-of-exploration.md"
    "05-01-00-the-voyages-of-discovery.md"
    "05-01-01-christopher-columbus-and-the-new-world.md"
    "05-01-02-vasco-da-gama-and-the-sea-route-to-india.md"
    "05-01-03-ferdinand-magellan-and-the-first-circumnavigation.md"
    "05-01-04-zheng-he-and-the-ming-dynasty-treasure-fleets.md"

    "05-02-00-the-columbian-exchange.md"
    "05-02-01-the-impact-of-european-diseases-on-indigenous-populations.md"
    "05-02-02-the-introduction-of-new-crops-between-continents.md"
    "05-02-03-the-spread-of-domesticated-animals-across-the-world.md"

    "05-03-00-the-conquest-of-the-americas.md"
    "05-03-01-the-spanish-conquest-of-the-aztecs.md"
    "05-03-02-the-fall-of-the-inca-empire.md"
    "05-03-03-the-role-of-missionaries-in-the-new-world.md"
    "05-03-04-the-encomienda-system-and-the-rise-of-spanish-colonies.md"

    "05-04-00-the-atlantic-slave-trade.md"
    "05-04-01-the-middle-passage-and-the-horrors-of-the-slave-ship-journeys.md"
    "05-04-02-slavery-in-the-americas-and-the-plantation-system.md"
    "05-04-03-resistance-rebellions-and-the-path-to-abolition.md"

    "05-05-00-the-rise-of-european-empires.md"
    "05-05-01-the-portuguese-and-dutch-trading-empires.md"
    "05-05-02-the-spanish-empire-and-the-silver-trade.md"
    "05-05-03-the-british-and-french-colonial-rivalry.md"
    "05-05-04-the-establishment-of-new-world-colonies.md"

    "05-06-00-the-economic-impact-of-the-age-of-exploration.md"
    "05-06-01-mercantilism-and-the-rise-of-european-capitalism.md"
    "05-06-02-the-role-of-silver-and-gold-in-global-trade.md"
    "05-06-03-how-the-spanish-empire-was-undermined-by-inflation.md"
    "05-06-04-the-dutch-and-british-east-india-companies-and-early-corporate-power.md"

    "05-07-00-the-portuguese-in-asia-and-africa.md"
    "05-07-01-the-founding-of-goa-macau-and-trade-dominance.md"
    "05-07-02-how-the-portuguese-controlled-indian-ocean-trade.md"

    "05-08-00-the-haitian-revolution-and-the-end-of-slavery-in-the-americas.md"
    "05-08-01-how-the-haitian-rebellion-defeated-the-french-empire.md"
    "05-08-02-the-aftermath-of-haitian-independence.md"

    "05-09-00-the-protestant-reformation-and-religious-wars.md"
    "05-09-01-martin-luther-the-95-theses-and-the-birth-of-protestantism.md"
    "05-09-02-calvinism-and-the-rise-of-puritanism.md"
    "05-09-03-the-catholic-counter-reformation-and-the-council-of-trent.md"
    "05-09-04-the-30-years-war-and-the-devastation-of-central-europe.md"
    "05-09-05-the-westphalian-peace-and-the-birth-of-the-modern-state.md"

    "06-00-00-revolutions-and-the-birth-of-the-modern-world.md"
    "06-01-00-the-enlightenment-and-scientific-revolution.md"
    "06-01-01-galileo-newton-and-the-rise-of-modern-science.md"
    "06-01-02-the-philosophers-of-the-enlightenment.md"
    "06-01-03-the-ideas-of-liberty-and-reason.md"

    "06-02-00-the-american-revolution.md"
    "06-02-01-the-causes-of-the-american-revolution.md"
    "06-02-02-the-declaration-of-independence-and-the-war-of-independence.md"
    "06-02-03-the-constitution-and-the-birth-of-a-new-nation.md"

    "06-03-00-the-french-revolution-and-napoleon.md"
    "06-03-01-the-rise-of-the-revolution-and-the-storming-of-the-bastille.md"
    "06-03-02-the-reign-of-terror-and-the-fall-of-the-monarchy.md"
    "06-03-03-napoleon-bonaparte-and-the-french-empire.md"

    "06-04-00-the-industrial-revolution.md"
    "06-04-01-the-invention-of-the-steam-engine-and-the-rise-of-factories.md"
    "06-04-02-urbanization-and-the-growth-of-industrial-cities.md"
    "06-04-03-the-social-impact-of-industrialization-child-labor-and-workers-rights.md"
    "06-04-04-the-spread-of-industrialization-across-the-world.md"

    "06-05-00-the-rise-of-nationalism-and-imperialism.md"
    "06-05-01-the-unification-of-germany-and-italy.md"
    "06-05-02-the-scramble-for-africa-and-european-imperialism.md"
    "06-05-03-the-meiji-restoration-and-the-modernization-of-japan.md"
    "06-05-04-the-sepoy-rebellion-and-the-end-of-the-mughal-empire.md"

    "06-06-00-the-mexican-revolution-and-the-fall-of-the-spanish-empire.md"
    "06-06-01-the-causes-of-the-mexican-war-of-independence.md"
    "06-06-02-the-fall-of-mexico-city-to-the-united-states.md"
    "06-06-03-how-the-mexican-american-war-shaped-the-us-southwest.md"

    "06-07-00-the-opium-wars-and-the-unequal-treaties.md"
    "06-07-01-how-britain-forced-china-open-to-trade.md"
    "06-07-02-the-treaty-of-nanjing-and-the-loss-of-hong-kong.md"

    "06-08-00-the-scramble-for-africa-and-the-berlin-conference.md"
    "06-08-01-how-european-powers-divided-africa.md"
    "06-08-02-resistance-movements-against-colonial-rule.md"

    "06-09-00-the-19th-century-explosion-in-science-and-medicine.md"
    "06-09-01-louis-pasteur-and-the-germ-theory-of-disease.md"
    "06-09-02-the-rise-of-chemistry-dmitri-mendeleev-and-the-periodic-table.md"
    "06-09-03-electricity-and-innovation-tesla-edison-and-the-current-wars.md"
    "06-09-04-medical-advances-vaccines-anesthesia-and-modern-surgery.md"
    "06-09-05-industrial-chemistry-and-the-development-of-modern-materials.md"

    "06-10-00-the-rise-of-marxism-and-the-response-to-industrial-capitalism.md"
    "06-10-01-karl-marx-friedrich-engels-and-the-communist-manifesto.md"
    "06-10-02-theories-of-socialism-and-the-workers-movement.md"
    "06-10-03-how-marxist-thought-influenced-revolutions-worldwide.md"

    "07-00-00-the-20th-century-world-wars-and-global-conflict.md"
    "07-01-00-world-war-i.md"
    "07-01-01-the-causes-of-world-war-i-alliances-and-militarism.md"
    "07-01-02-the-trench-warfare-and-technological-advancements.md"
    "07-01-03-the-treaty-of-versailles-and-the-aftermath.md"

    "07-02-00-the-russian-revolution-and-the-rise-of-communism.md"
    "07-02-01-the-end-of-the-romanovs-and-the-bolshevik-takeover.md"
    "07-02-02-lenin-stalin-and-the-formation-of-the-soviet-union.md"

    "07-03-00-the-great-depression-and-economic-collapse.md"
    "07-03-01-the-stock-market-crash-of-1929.md"
    "07-03-02-global-unemployment-and-poverty-during-the-depression.md"
    "07-03-03-the-rise-of-authoritarian-regimes-hitler-mussolini-and-tojo.md"

    "07-04-00-world-war-ii.md"
    "07-04-01-the-invasion-of-poland-and-the-start-of-the-war.md"
    "07-04-02-the-battle-of-britain-and-the-blitz.md"
    "07-04-03-the-pacific-theater-and-pearl-harbor.md"
    "07-04-04-the-holocaust-and-the-crimes-of-nazi-germany.md"
    "07-04-05-the-d-day-landings-and-the-end-of-the-war-in-europe.md"
    "07-04-06-the-atomic-bombings-of-hiroshima-and-nagasaki.md"

    "07-05-00-the-cold-war.md"
    "07-05-01-the-berlin-blockade-and-the-rise-of-the-iron-curtain.md"
    "07-05-02-the-space-race-and-the-moon-landing.md"
    "07-05-03-the-cuban-missile-crisis-and-nuclear-standoff.md"
    "07-05-04-the-fall-of-the-soviet-union-and-the-end-of-the-cold-war.md"

    "07-06-00-decolonization-and-the-rise-of-new-nations.md"
    "07-06-01-indian-independence-and-the-partition-of-india.md"
    "07-06-02-africa-decolonization-and-the-struggles-for-self-rule.md"
    "07-06-03-the-end-of-colonial-rule-in-southeast-asia.md"

    "07-07-00-the-changing-world-order.md"
    "07-07-01-the-rise-of-china-and-the-global-balance-of-power.md"
    "07-07-02-the-growth-of-the-european-union-and-global-trade.md"
    "07-07-03-the-formation-of-nato-and-modern-military-alliances.md"

    "07-08-00-modern-economics-and-global-finance.md"
    "07-08-01-the-great-depression-and-the-gold-standard.md"
    "07-08-02-keynesian-economics-vs-the-austrian-school.md"
    "07-08-03-the-nixon-shock-and-the-end-of-the-gold-standard.md"
    "07-08-04-the-petrodollar-and-us-financial-hegemony.md"
    "07-08-05-the-2008-financial-crisis-and-the-rise-of-bitcoin.md"

    "07-09-00-the-armenian-genocide-and-the-collapse-of-the-ottoman-empire.md"
    "07-09-01-how-world-war-i-led-to-the-armenian-genocide.md"
    "07-09-02-the-dissolution-of-the-ottoman-empire-and-its-aftermath.md"

    "07-10-00-the-rise-and-fall-of-austro-hungary.md"
    "07-10-01-the-habsburg-dynasty-and-the-dual-monarchy.md"
    "07-10-02-how-ethnic-tensions-led-to-the-collapse-of-austro-hungary.md"

    "07-11-00-the-spanish-civil-war-and-its-impact-on-world-war-ii.md"
    "07-11-01-the-nationalists-vs-the-republicans.md"
    "07-11-02-how-the-spanish-civil-war-became-a-prelude-to-world-war-ii.md"

    "07-12-00-the-iran-iraq-war-1980-1988.md"
    "07-12-01-the-origins-of-the-conflict-and-the-role-of-the-us-and-soviets.md"
    "07-12-02-how-the-war-shaped-the-modern-middle-east.md"

    "07-10-00-the-final-collapse-of-the-ottoman-empire-and-the-middle-east.md"
    "07-10-01-how-world-war-i-dismantled-the-ottoman-empire.md"
    "07-10-02-the-sykes-picot-agreement-and-the-division-of-the-middle-east.md"
    "07-10-03-the-balfour-declaration-and-the-road-to-israel.md"

    "07-11-00-the-decline-and-collapse-of-the-british-empire.md"
    "07-11-01-the-cost-of-world-war-ii-and-the-loss-of-colonies.md"
    "07-11-02-the-indian-independence-movement-and-gandhi.md"
    "07-11-03-the-winds-of-change-in-africa-and-caribbean-decolonization.md"

    # Modern Conflicts (20th Century)
    "07-12-00-the-korean-war-the-first-hot-war-of-the-cold-war.md"
    "07-12-01-how-the-korean-peninsula-became-divided.md"
    "07-12-02-the-chinese-intervention-and-the-stalemate.md"
    "07-12-03-the-aftermath-of-the-korean-war-and-its-legacy.md"

    "07-13-00-the-vietnam-war-and-the-global-anti-war-movement.md"
    "07-13-01-the-dien-bien-phu-defeat-and-the-end-of-french-indochina.md"
    "07-13-02-the-gulf-of-tonkin-incident-and-escalation.md"
    "07-13-03-the-tet-offensive-and-the-turning-point-of-the-war.md"
    "07-13-04-the-fall-of-saigon-and-the-end-of-the-vietnam-war.md"

    "07-14-00-the-rise-of-radical-islam-and-the-war-on-terror.md"
    "07-14-01-the-soviet-afghan-war-and-the-origins-of-al-qaeda.md"
    "07-14-02-the-september-11-attacks-and-the-war-in-afghanistan.md"
    "07-14-03-the-iraq-war-weapons-of-mass-destruction-and-regime-change.md"
    "07-14-04-the-rise-and-fall-of-isis.md"

    # The Financial System in More Detail (20th-21st Century)
    "07-15-00-the-bretton-woods-agreement-and-the-imf-world-bank.md"
    "07-15-01-how-the-us-dollar-became-the-global-reserve-currency.md"
    "07-15-02-the-rise-of-multinational-corporations-and-global-capitalism.md"
    "07-15-03-the-growth-of-central-banking-and-fiat-currency.md"


    "08-00-00-the-21st-century-and-the-future.md"

    "08-01-00-globalization-and-the-digital-revolution.md"
    "08-01-01-the-internet-and-the-information-age.md"
    "08-01-02-the-rise-of-social-media-and-its-impact-on-politics-and-culture.md"
    "08-01-03-the-role-of-media-and-propaganda-in-modern-history.md"
    "08-01-04-how-mass-media-shaped-public-opinion-in-the-20th-century.md"
    "08-01-05-the-rise-of-social-media-and-its-political-influence.md"
    "08-01-06-mass-surveillance-and-the-modern-security-state.md"

    "08-02-00-the-changing-geopolitical-landscape.md"
    "08-02-01-the-us-china-competition-and-economic-war.md"
    "08-02-02-the-rise-of-china-and-the-belt-and-road-initiative.md"
    "08-02-03-chinas-economic-rise-and-global-trade-influence.md"
    "08-02-04-the-geopolitical-strategies-of-the-belt-and-road-initiative.md"
    "08-02-05-the-role-of-private-military-companies-in-modern-conflicts.md"

    "08-03-00-modern-society-and-the-future-of-governance.md"
    "08-03-01-the-changing-nature-of-governance-and-sovereignty-in-a-digital-age.md"
    "08-03-02-the-modern-migration-crisis-and-global-demographics.md"
    "08-03-03-the-impact-of-mass-migration-on-europe-and-the-us.md"
    "08-03-04-demographic-changes-and-future-population-trends.md"
    "08-03-05-the-role-of-big-tech-in-governance-and-society.md"
    "08-03-06-how-google-facebook-and-ai-are-shaping-the-modern-world.md"
    "08-03-07-the-debate-over-privacy-and-digital-surveillance.md"

    "08-04-00-the-future-of-humanity-possibilities-and-perils.md"
    "08-04-01-existential-risks-to-humanity-nuclear-war-biotech-ai.md"
    "08-04-02-the-impact-of-automation-and-artificial-intelligence-on-society.md"
    "08-04-03-how-technological-change-could-shape-the-economy-and-workforce.md"
    "08-04-04-the-future-of-money-decentralization-digital-currencies-and-global-trade.md"
    "08-04-05-the-role-of-scientific-advancements-in-medicine-and-longevity.md"
    "08-04-06-space-exploration-and-the-possibility-of-human-settlement-beyond-earth.md"
    "08-04-07-utopian-and-dystopian-visions-of-the-future.md"
    "08-04-08-the-challenges-and-opportunities-of-a-globalized-world.md"
    "08-04-09-how-human-values-and-culture-might-evolve-in-the-coming-centuries.md"

    # The Modern Surveillance State (21st Century)
    "08-05-00-the-rise-of-the-modern-surveillance-state.md"
    "08-05-01-edward-snowden-wikileaks-and-digital-leaks.md"
    "08-05-02-how-governments-use-ai-and-mass-data-for-control.md"
    "08-05-03-chinas-social-credit-system-and-the-future-of-surveillance.md"
)

# Loop through files and run `corpora workon`
for file in "${files[@]}"; do
    corpora infer "$file" --check ./build.sh
    git add .
    git commit -m "Add $file"
    corpora sync --noinput
done
