import type { LucideIcon } from 'lucide-react';
import {
  Apple, Banana, Bike, Bird, BookOpen, Bug, Bus, CakeSlice, Candy, Car, Carrot, Cat, Cherry, Cloud, Clover, Cookie, Crown,
  Dice5, Dog, Egg, Feather, Fish, Flower2, Gem, Gift, Grape, Heart, IceCreamCone, Leaf, Moon, Music, PawPrint, Pencil,
  Pizza, Plane, Puzzle, Rabbit, Rocket, Sailboat, Sandwich, Shell, Snail, Snowflake, Sprout, Squirrel, Star, Sun, ToyBrick,
  TrainFront, TreeDeciduous, Trophy, Turtle,
} from 'lucide-react';
import type { ColorToken, IconName } from '../spec';

/** Bundled pictograph set (lucide, ISC). Default tone keeps pictures varied but calm. */
export const ICONS: Record<IconName, [LucideIcon, ColorToken]> = {
  apple: [Apple, 'coral'], banana: [Banana, 'gold'], cherry: [Cherry, 'coral'], grape: [Grape, 'blue'], carrot: [Carrot, 'gold'],
  cookie: [Cookie, 'gold'], cake: [CakeSlice, 'coral'], pizza: [Pizza, 'gold'], ice_cream: [IceCreamCone, 'blue'], egg: [Egg, 'gold'],
  candy: [Candy, 'coral'], sandwich: [Sandwich, 'gold'], fish: [Fish, 'teal'], bird: [Bird, 'blue'], cat: [Cat, 'gold'], dog: [Dog, 'gold'],
  rabbit: [Rabbit, 'teal'], turtle: [Turtle, 'teal'], snail: [Snail, 'gold'], bug: [Bug, 'coral'], squirrel: [Squirrel, 'gold'],
  paw: [PawPrint, 'teal'], star: [Star, 'gold'], heart: [Heart, 'coral'], flower: [Flower2, 'coral'], leaf: [Leaf, 'teal'],
  tree: [TreeDeciduous, 'teal'], sprout: [Sprout, 'teal'], sun: [Sun, 'gold'], moon: [Moon, 'blue'], cloud: [Cloud, 'blue'],
  snowflake: [Snowflake, 'blue'], shell: [Shell, 'coral'], feather: [Feather, 'teal'], clover: [Clover, 'teal'], car: [Car, 'coral'],
  bus: [Bus, 'gold'], bike: [Bike, 'teal'], boat: [Sailboat, 'blue'], rocket: [Rocket, 'coral'], train: [TrainFront, 'blue'],
  plane: [Plane, 'blue'], pencil: [Pencil, 'gold'], book: [BookOpen, 'teal'], gift: [Gift, 'coral'], crown: [Crown, 'gold'],
  gem: [Gem, 'blue'], trophy: [Trophy, 'gold'], puzzle: [Puzzle, 'teal'], block: [ToyBrick, 'coral'], music: [Music, 'blue'], dice: [Dice5, 'coral'],
};
