import type { LucideIcon } from 'lucide-react';
import {
  Anchor, Apple, Armchair, Axe, Baby, Backpack, Banana, Banknote, Bath, Bean, Bed, Beef, Bell, Bike, Binoculars, Bird, Bone, Book, BookOpen,
  Bot, Box, Brain, BrickWall, Briefcase, Brush, Bug, Building, Bus, Cake, CakeSlice, Calculator, Calendar, Camera, Candy, CandyCane, Car,
  Caravan, Carrot, Castle, Cat, ChefHat, Cherry, Church, Circle, Citrus, Clapperboard, Clock, Cloud, CloudRain, CloudSnow, Clover, Coffee,
  Coins, Compass, Cone, Cookie, CookingPot, Croissant, Crown, Cuboid, CupSoda, Cylinder, Diamond, Dice5, Dog, Donut, DoorOpen, Drum,
  Drumstick, Droplet, Dumbbell, Egg, Eraser, Factory, Fan, Feather, Fence, FerrisWheel, Film, Fish, Flag, Flame, FlaskConical, Flower,
  Flower2, Footprints, Gamepad2, Gem, Ghost, Gift, GlassWater, Globe, Grape, GraduationCap, Guitar, Hammer, Hand, HardHat,
  Headphones, Heart, Hexagon, Home, Hourglass, IceCreamCone, Key, Lamp, Laptop, Leaf, LeafyGreen, Library, Lightbulb, Lollipop, Luggage,
  Magnet, Mail, Map, Medal, Megaphone, Microscope, Milk, Moon, Mountain, MountainSnow, Mouse, Music, Notebook, Nut, Octagon,
  Origami, Package, PaintBucket, Paintbrush, Palette, Palmtree, PartyPopper, PawPrint, Pencil, Pentagon, Piano, PiggyBank, Pill, Pizza,
  Plane, Popcorn, Popsicle, Puzzle, Pyramid, Rabbit, Radio, Rainbow, Rat, Ribbon, Rocket, RollerCoaster, Ruler, Sailboat, Salad, Sandwich,
  Satellite, Scale, School, Scissors, Shell, Ship, Shirt, ShoppingBasket, ShoppingCart, Shovel, Shrub, Smartphone, Snail, Snowflake, Sofa,
  Soup, Sparkles, Sprout, Square, Squirrel, Star, Sticker, Store, Sun, Sword, Tent, Telescope, Thermometer, Ticket, Timer, Tornado,
  ToyBrick, Tractor, TrafficCone, TrainFront, TreeDeciduous, TreePalm, TreePine, Triangle, Trophy, Truck, Turtle, Tv, Umbrella, Utensils,
  Volleyball, Wallet, Watch, Waves, Wheat, Wind, Wine, Worm, Wrench, Zap,
} from 'lucide-react';
import type { ColorToken } from '../spec';

/**
 * Bundled pictograph vocabulary (lucide, ISC): a broad set of everyday objects the model names in
 * singular snake_case. The model is never limited to a short list: a name outside this table, after
 * the plural and alias rules, draws a neutral counter (a plain disc), which is still a sound thing
 * to count. Raw SVG, URLs and markup are never accepted, only these bundled components.
 * Each entry is [component, default tone]; the tone keeps pictures varied but calm.
 */
const T = (icon: LucideIcon, tone: ColorToken) => [icon, tone] as const;
export const ICONS: Record<string, readonly [LucideIcon, ColorToken]> = {
  // food
  apple: T(Apple, 'coral'), banana: T(Banana, 'gold'), cherry: T(Cherry, 'coral'), grape: T(Grape, 'blue'), lemon: T(Citrus, 'gold'),
  orange: T(Citrus, 'gold'), lime: T(Citrus, 'teal'), carrot: T(Carrot, 'gold'), bean: T(Bean, 'teal'), lettuce: T(LeafyGreen, 'teal'),
  salad: T(Salad, 'teal'), wheat: T(Wheat, 'gold'), nut: T(Nut, 'gold'), cookie: T(Cookie, 'gold'), cake: T(CakeSlice, 'coral'),
  birthday_cake: T(Cake, 'coral'), donut: T(Donut, 'coral'), croissant: T(Croissant, 'gold'), pizza: T(Pizza, 'gold'), sandwich: T(Sandwich, 'gold'),
  soup: T(Soup, 'coral'), pot: T(CookingPot, 'blue'), egg: T(Egg, 'gold'), drumstick: T(Drumstick, 'gold'), meat: T(Beef, 'coral'),
  ice_cream: T(IceCreamCone, 'blue'), popsicle: T(Popsicle, 'coral'), candy: T(Candy, 'coral'), candy_cane: T(CandyCane, 'coral'),
  lollipop: T(Lollipop, 'coral'), popcorn: T(Popcorn, 'gold'), milk: T(Milk, 'blue'), juice: T(CupSoda, 'coral'), cup: T(CupSoda, 'blue'),
  glass: T(GlassWater, 'blue'), water: T(Droplet, 'blue'), drop: T(Droplet, 'blue'), coffee: T(Coffee, 'gold'), mug: T(Coffee, 'gold'),
  fork: T(Utensils, 'blue'), chef_hat: T(ChefHat, 'blue'), basket: T(ShoppingBasket, 'gold'), grapes: T(Grape, 'blue'),
  // animals
  fish: T(Fish, 'teal'), bird: T(Bird, 'blue'), cat: T(Cat, 'gold'), dog: T(Dog, 'gold'), rabbit: T(Rabbit, 'teal'), bunny: T(Rabbit, 'teal'),
  turtle: T(Turtle, 'teal'), snail: T(Snail, 'gold'), bug: T(Bug, 'coral'), beetle: T(Bug, 'coral'), ladybug: T(Bug, 'coral'), insect: T(Bug, 'coral'),
  squirrel: T(Squirrel, 'gold'), mouse: T(Mouse, 'blue'), rat: T(Rat, 'blue'), worm: T(Worm, 'coral'), paw: T(PawPrint, 'teal'),
  footprint: T(Footprints, 'teal'), feather: T(Feather, 'teal'), bone: T(Bone, 'gold'), shell: T(Shell, 'coral'), seashell: T(Shell, 'coral'),
  // plants and nature
  flower: T(Flower2, 'coral'), daisy: T(Flower, 'gold'), tulip: T(Flower2, 'coral'), rose: T(Flower2, 'coral'), leaf: T(Leaf, 'teal'),
  tree: T(TreeDeciduous, 'teal'), pine_tree: T(TreePine, 'teal'), palm_tree: T(TreePalm, 'teal'), bush: T(Shrub, 'teal'), sprout: T(Sprout, 'teal'),
  seed: T(Bean, 'gold'), plant: T(Sprout, 'teal'), clover: T(Clover, 'teal'), mountain: T(Mountain, 'blue'), snowy_mountain: T(MountainSnow, 'blue'),
  wave: T(Waves, 'blue'), rainbow: T(Rainbow, 'coral'), sun: T(Sun, 'gold'), moon: T(Moon, 'blue'), star: T(Star, 'gold'), cloud: T(Cloud, 'blue'),
  rain: T(CloudRain, 'blue'), raincloud: T(CloudRain, 'blue'), snow: T(CloudSnow, 'blue'), snowflake: T(Snowflake, 'blue'), wind: T(Wind, 'blue'),
  tornado: T(Tornado, 'blue'), lightning: T(Zap, 'gold'), fire: T(Flame, 'coral'), flame: T(Flame, 'coral'), sparkle: T(Sparkles, 'gold'),
  // science and space
  rocket: T(Rocket, 'coral'), planet: T(Globe, 'blue'), globe: T(Globe, 'blue'), earth: T(Globe, 'blue'), satellite: T(Satellite, 'blue'),
  telescope: T(Telescope, 'blue'), microscope: T(Microscope, 'teal'), magnet: T(Magnet, 'coral'), flask: T(FlaskConical, 'teal'),
  beaker: T(FlaskConical, 'teal'), thermometer: T(Thermometer, 'coral'), lightbulb: T(Lightbulb, 'gold'), bulb: T(Lightbulb, 'gold'),
  brain: T(Brain, 'coral'), robot: T(Bot, 'blue'),
  // vehicles and travel
  car: T(Car, 'coral'), bus: T(Bus, 'gold'), truck: T(Truck, 'blue'), tractor: T(Tractor, 'gold'), bike: T(Bike, 'teal'), bicycle: T(Bike, 'teal'),
  boat: T(Sailboat, 'blue'), sailboat: T(Sailboat, 'blue'), ship: T(Ship, 'blue'), anchor: T(Anchor, 'blue'), train: T(TrainFront, 'blue'),
  plane: T(Plane, 'blue'), airplane: T(Plane, 'blue'), caravan: T(Caravan, 'gold'), traffic_cone: T(TrafficCone, 'coral'), map: T(Map, 'teal'),
  compass: T(Compass, 'blue'), suitcase: T(Luggage, 'coral'), ticket: T(Ticket, 'gold'), tent: T(Tent, 'teal'),
  // sport and play
  ball: T(Volleyball, 'coral'), volleyball: T(Volleyball, 'coral'), trophy: T(Trophy, 'gold'), medal: T(Medal, 'gold'), dumbbell: T(Dumbbell, 'blue'),
  flag: T(Flag, 'coral'), puzzle: T(Puzzle, 'teal'), dice: T(Dice5, 'coral'), die: T(Dice5, 'coral'),
  block: T(ToyBrick, 'coral'), brick: T(ToyBrick, 'coral'), game: T(Gamepad2, 'blue'), party: T(PartyPopper, 'coral'),
  gift: T(Gift, 'coral'), present: T(Gift, 'coral'), sticker: T(Sticker, 'gold'), ribbon: T(Ribbon, 'coral'), crown: T(Crown, 'gold'),
  gem: T(Gem, 'blue'), jewel: T(Gem, 'blue'), ferris_wheel: T(FerrisWheel, 'coral'), roller_coaster: T(RollerCoaster, 'coral'), ghost: T(Ghost, 'blue'),
  origami: T(Origami, 'coral'), sword: T(Sword, 'blue'),
  // music and art
  music: T(Music, 'blue'), drum: T(Drum, 'coral'), guitar: T(Guitar, 'gold'), piano: T(Piano, 'blue'),
  headphones: T(Headphones, 'blue'), radio: T(Radio, 'gold'), megaphone: T(Megaphone, 'coral'), bell: T(Bell, 'gold'), paintbrush: T(Paintbrush, 'coral'),
  brush: T(Brush, 'coral'), palette: T(Palette, 'coral'), paint: T(PaintBucket, 'blue'), film: T(Film, 'blue'), clapperboard: T(Clapperboard, 'blue'),
  camera: T(Camera, 'blue'),
  // school and home
  pencil: T(Pencil, 'gold'), crayon: T(Pencil, 'coral'), eraser: T(Eraser, 'coral'), ruler: T(Ruler, 'gold'), scissors: T(Scissors, 'blue'),
  book: T(BookOpen, 'teal'), closed_book: T(Book, 'teal'), notebook: T(Notebook, 'blue'), backpack: T(Backpack, 'coral'), calculator: T(Calculator, 'blue'),
  graduation_cap: T(GraduationCap, 'blue'), library: T(Library, 'teal'), school: T(School, 'gold'), calendar: T(Calendar, 'blue'),
  clock: T(Clock, 'blue'), watch: T(Watch, 'blue'), timer: T(Timer, 'blue'), hourglass: T(Hourglass, 'gold'), letter: T(Mail, 'blue'),
  envelope: T(Mail, 'blue'), box: T(Box, 'gold'), package: T(Package, 'gold'), house: T(Home, 'coral'), home: T(Home, 'coral'),
  building: T(Building, 'blue'), castle: T(Castle, 'blue'), church: T(Church, 'blue'), factory: T(Factory, 'blue'), store: T(Store, 'coral'),
  shop: T(Store, 'coral'), door: T(DoorOpen, 'gold'), key: T(Key, 'gold'), lamp: T(Lamp, 'gold'), chair: T(Armchair, 'coral'),
  sofa: T(Sofa, 'coral'), bed: T(Bed, 'blue'), bath: T(Bath, 'blue'), fan: T(Fan, 'blue'), umbrella: T(Umbrella, 'coral'), shirt: T(Shirt, 'blue'),
  baby: T(Baby, 'gold'), hand: T(Hand, 'gold'), heart: T(Heart, 'coral'), phone: T(Smartphone, 'blue'),
  laptop: T(Laptop, 'blue'), tv: T(Tv, 'blue'), pill: T(Pill, 'coral'), binoculars: T(Binoculars, 'blue'), briefcase: T(Briefcase, 'gold'),
  // tools and building
  hammer: T(Hammer, 'gold'), wrench: T(Wrench, 'blue'), axe: T(Axe, 'coral'), shovel: T(Shovel, 'gold'), hard_hat: T(HardHat, 'gold'),
  fence: T(Fence, 'gold'), wall: T(BrickWall, 'coral'), scale: T(Scale, 'blue'),
  // money and shopping
  coin: T(Coins, 'gold'), banknote: T(Banknote, 'teal'), bill: T(Banknote, 'teal'), wallet: T(Wallet, 'gold'), piggy_bank: T(PiggyBank, 'coral'),
  cart: T(ShoppingCart, 'blue'),
  // shapes
  circle: T(Circle, 'teal'), square: T(Square, 'blue'), triangle: T(Triangle, 'gold'), hexagon: T(Hexagon, 'teal'), pentagon: T(Pentagon, 'coral'),
  octagon: T(Octagon, 'coral'), diamond: T(Diamond, 'blue'), cube: T(Cuboid, 'blue'), cylinder: T(Cylinder, 'teal'), cone: T(Cone, 'gold'),
  pyramid: T(Pyramid, 'gold'),
};

/** Synonyms whose drawing is still the same kind of thing (a duck is a bird); never a different object:
 * a muffin drawn as a cake slice contradicts the text (spec-eval), so an unmatched noun gets the neutral
 * counter, which never does. */
const ALIASES: Record<string, string> = {
  puppy: 'dog', kitten: 'cat', hare: 'rabbit', ant: 'bug', bee: 'bug', butterfly: 'bug', caterpillar: 'worm', chick: 'bird', duck: 'bird',
  hen: 'bird', chicken: 'bird', owl: 'bird', parrot: 'bird', penguin: 'bird', goldfish: 'fish', biscuit: 'cookie', acorn: 'nut',
  sweet: 'candy', chocolate: 'candy', bowl: 'soup', automobile: 'car', taxi: 'car', van: 'truck', jet: 'plane',
  canoe: 'boat', kayak: 'boat', ferry: 'ship', scooter: 'bike', soccer_ball: 'ball', basketball: 'ball', football: 'ball', baseball: 'ball',
  tennis_ball: 'ball', marble: 'circle', bead: 'circle', counter: 'circle', dot: 'circle', token: 'circle', disc: 'circle',
  toy: 'block', crystal: 'gem', ring: 'gem', trumpet: 'music', flute: 'music',
  song: 'music', marker: 'pencil', pen: 'pencil', paper: 'notebook', page: 'notebook', chest: 'box',
  crate: 'box', bag: 'backpack', lantern: 'lamp', sunflower: 'flower',
  forest: 'tree', cookies: 'cookie',
};

const DISC = T(Circle, 'teal');
/** The drawing for a model-named object: exact name, singular form, alias, else a neutral counter. */
export function resolveIcon(name: string): readonly [LucideIcon, ColorToken] {
  const n = name.toLowerCase();
  // Singular by spelling rules: "berries" → "berry", "boxes" → "box", "apples" → "apple"; never "rates" → "rat".
  const candidates = [n, ...(n.length > 4 && n.endsWith('ies') ? [`${n.slice(0, -3)}y`] : []), ...(/(s|x|z|ch|sh)es$/.test(n) ? [n.slice(0, -2)] : []), ...(/[^su]s$/.test(n) ? [n.slice(0, -1)] : [])];
  for (const c of candidates) {
    // Own keys only: a name like "constructor" must never reach Object.prototype.
    const alias = Object.hasOwn(ALIASES, c) ? ALIASES[c]! : undefined;
    const hit = Object.hasOwn(ICONS, c) ? ICONS[c] : alias && Object.hasOwn(ICONS, alias) ? ICONS[alias] : undefined;
    if (hit) return hit;
  }
  return DISC;
}
/** True when `name` has its own drawing (not the neutral counter). */
export const hasIcon = (name: string) => resolveIcon(name) !== DISC;
