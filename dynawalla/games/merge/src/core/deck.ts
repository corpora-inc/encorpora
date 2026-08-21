import { Rng } from "./rng.ts";

/**
 * The spawn deck.
 *
 * A bag randomiser that deals in *complements*: every value it hands you has a
 * partner already in the bag. You are never dealt a tile the well cannot use —
 * if the run ends it is because of where you put things, which is the only
 * honest reason for a puzzle game to end.
 *
 * Items are drawn from a random position in the bag, so the partner arrives
 * some unpredictable number of tiles later. That gap is the whole game.
 */
export class Deck {
  private bag: number[] = [];
  private key: number;
  private rng: Rng;
  private triplePct: number;

  constructor(rng: Rng, key: number, triplePct = 12) {
    this.rng = rng;
    this.key = key;
    this.triplePct = triplePct;
    this.refill();
  }

  /** Reset for a new KEY. Any partner still owed under the old key is dropped. */
  retune(key: number, triplePct: number): void {
    this.key = key;
    this.triplePct = triplePct;
    this.bag = [];
    this.refill();
  }

  private addPair(): void {
    // a in [1, key-1]; the pair is (a, key-a)
    const a = this.rng.range(1, this.key - 1);
    this.bag.push(a, this.key - a);
  }

  private addTriple(): void {
    // a + b + c = key, each >= 1
    const a = this.rng.range(1, this.key - 2);
    const b = this.rng.range(1, this.key - a - 1);
    this.bag.push(a, b, this.key - a - b);
  }

  private refill(): void {
    while (this.bag.length < 14) {
      if (this.key >= 3 && this.rng.chance(this.triplePct, 100)) this.addTriple();
      else this.addPair();
    }
  }

  /** Next tile value. */
  deal(): number {
    this.refill();
    const i = this.rng.int(this.bag.length);
    const v = this.bag[i] as number;
    this.bag.splice(i, 1);
    return v;
  }

  /** Peek at what is still owed, for the "incoming" strip. */
  size(): number {
    return this.bag.length;
  }
}
