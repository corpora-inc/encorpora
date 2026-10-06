/** Hand-authored TEST FIXTURES (K–2). Development material, never shipped as or labeled AI output. */
import type { ActivitySpec } from '../spec';

export const k2Fixtures: ActivitySpec[] = [
  {
    version: 1, id: 'fx-k-count-apples', title: 'Apples in the basket', skillIds: ['K.CC.B.5'], difficulty: 2,
    prompt: [
      { type: 'text', text: 'Some apples rolled out of the basket. Count them carefully.' },
      { type: 'figure', figureId: 'apples' },
      { type: 'text', text: 'How many apples are there?' },
    ],
    figures: [{ type: 'picture', id: 'apples', alt: 'Seven apples scattered on the ground.', groups: [{ icon: 'apple', count: 7, arrangement: 'scattered' }] }],
    response: { type: 'numeric', answer: 7, misconceptionAnswers: [{ answer: 6, tag: 'skipped_object' }, { answer: 8, tag: 'double_counted' }] },
    keyCheck: { value: '7' },
    hints: ['Touch each apple once as you say a number.', 'The last number you say tells how many.'],
    explanation: 'Point to each apple one time: 1, 2, 3, 4, 5, 6, 7. The last number is 7, so there are 7 apples.',
    misconceptions: [{ tag: 'skipped_object', description: 'Missed an object while counting.' }, { tag: 'double_counted', description: 'Counted one object twice.' }],
  },
  {
    version: 1, id: 'fx-k-make-ten', title: 'Fill the ten frame', skillIds: ['K.OA.A.4'], difficulty: 3,
    prompt: [
      { type: 'text', text: 'A ten frame has room for 10 stars.' },
      { type: 'figure', figureId: 'frame' },
      { type: 'text', text: 'How many more stars would fill it up?' },
    ],
    figures: [{ type: 'picture', id: 'frame', alt: 'A ten frame with 8 stars; 2 boxes are empty.', groups: [{ icon: 'star', count: 8, arrangement: 'ten_frame' }] }],
    response: {
      type: 'multiple_choice', shuffle: false,
      options: [
        { text: '1', correct: false, misconception: 'off_by_one' },
        { text: '2', correct: true },
        { text: '3', correct: false, misconception: 'off_by_one' },
        { text: '8', correct: false, misconception: 'counted_filled' },
      ],
    },
    hints: ['Look at the empty boxes.'],
    explanation: 'There are 8 stars. Two boxes are empty, and $8 + 2 = 10$.',
  },
  {
    version: 1, id: 'fx-k-which-more', title: 'Which group has more?', skillIds: ['K.CC.C.6'], difficulty: 2,
    prompt: [
      { type: 'text', text: 'Fish are swimming and birds are flying.' },
      { type: 'figure', figureId: 'groups' },
      { type: 'text', text: 'Tap the group that has more.' },
    ],
    figures: [{
      type: 'picture', id: 'groups', alt: 'Two groups: 5 fish and 7 birds.', layout: 'row',
      groups: [{ icon: 'fish', count: 5, id: 'fish', label: 'Fish' }, { icon: 'bird', count: 7, id: 'birds', label: 'Birds' }],
    }],
    response: { type: 'tap_region', figureId: 'groups', region: 'birds', regionMisconceptions: [{ region: 'fish', tag: 'compared_size_not_count' }] },
    hints: ['Count each group.'],
    explanation: 'There are 5 fish and 7 birds. 7 is more than 5, so the birds group has more.',
  },
  {
    version: 1, id: 'fx-k-find-triangle', title: 'Shape hunt', skillIds: ['K.G.A.2'], difficulty: 1,
    prompt: [{ type: 'text', text: 'Tap the triangle.' }, { type: 'figure', figureId: 'shapes' }],
    figures: [{
      type: 'geometry', id: 'shapes', alt: 'Three shapes: a square on the left, a triangle in the middle, and a circle on the right.', width: 30, height: 10,
      shapes: [
        { kind: 'polygon', id: 'square', points: [{ x: 1, y: 1.5 }, { x: 8, y: 1.5 }, { x: 8, y: 8.5 }, { x: 1, y: 8.5 }], color: 'blue' },
        { kind: 'polygon', id: 'triangle', points: [{ x: 11, y: 1.5 }, { x: 19, y: 1.5 }, { x: 15, y: 8.8 }], color: 'gold' },
        { kind: 'circle', id: 'circle', center: { x: 25, y: 5 }, r: 3.8, color: 'coral' },
      ],
    }],
    response: { type: 'tap_region', figureId: 'shapes', region: 'triangle' },
    explanation: 'A triangle has 3 straight sides and 3 corners. The middle shape is the triangle.',
  },
  {
    version: 1, id: 'fx-1-take-away', title: 'Cookie break', skillIds: ['1.OA.A.1'], difficulty: 3,
    prompt: [
      { type: 'text', text: 'There were 9 cookies on a plate. Friends ate the crossed-out ones.' },
      { type: 'figure', figureId: 'cookies' },
      { type: 'text', text: 'How many cookies are left?' },
    ],
    figures: [{ type: 'picture', id: 'cookies', alt: 'Nine cookies in a row; the last 4 are crossed out.', groups: [{ icon: 'cookie', count: 9, crossedOut: 4 }] }],
    response: { type: 'numeric', answer: 5, misconceptionAnswers: [{ answer: 4, tag: 'counted_removed' }, { answer: 13, tag: 'added_instead' }] },
    keyCheck: { value: '9 - 4' },
    hints: ['Count only the cookies that are not crossed out.'],
    explanation: '$9 - 4 = 5$. Five cookies are still on the plate.',
  },
  {
    version: 1, id: 'fx-1-beach-compare', title: 'At the beach', skillIds: ['1.OA.A.1'], difficulty: 3,
    prompt: [{ type: 'text', text: 'Kofi counts umbrellas and sailboats at the beach.' }, { type: 'figure', figureId: 'beach' }, { type: 'text', text: 'How many more umbrellas than sailboats are there?' }],
    figures: [{
      type: 'picture', id: 'beach', alt: 'Two rows: a row of 8 umbrellas and a row of 5 sailboats.', layout: 'column',
      groups: [{ icon: 'umbrella', count: 8, label: 'Umbrellas', id: 'umbrellas' }, { icon: 'sailboat', count: 5, label: 'Sailboats', id: 'boats' }],
    }],
    response: { type: 'numeric', answer: 3, misconceptionAnswers: [{ answer: 13, tag: 'added_instead' }] },
    keyCheck: { value: '8 - 5' },
    hints: ['Match each sailboat with an umbrella. How many umbrellas have no partner?'],
    explanation: '$8 - 5 = 3$. There are 3 more umbrellas.',
  },
  {
    version: 1, id: 'fx-1-half-hour', title: 'What time is it?', skillIds: ['1.MD.B.3'], difficulty: 3,
    prompt: [{ type: 'text', text: 'Look at the clock.' }, { type: 'figure', figureId: 'clock' }, { type: 'text', text: 'What time does it show?' }],
    figures: [{ type: 'clock', id: 'clock', alt: 'An analog clock. The short hour hand is halfway between 3 and 4. The long minute hand points to 6.', hour: 3, minute: 30 }],
    response: {
      type: 'multiple_choice',
      options: [
        { text: '3:30', correct: true },
        { text: '6:15', correct: false, misconception: 'swapped_hands' },
        { text: '4:30', correct: false, misconception: 'hour_hand_rounded_up' },
        { text: '3:06', correct: false, misconception: 'minute_hand_as_minutes' },
      ],
    },
    hints: ['The short hand tells the hour. It has passed 3 but not reached 4.', 'The long hand on 6 means half past.'],
    explanation: 'The hour hand is between 3 and 4, so it is after 3 o’clock. The minute hand on 6 means 30 minutes. The time is 3:30.',
  },
  {
    version: 1, id: 'fx-1-number-line-hop', title: 'Hop along', skillIds: ['1.OA.C.5'], difficulty: 3,
    prompt: [
      { type: 'text', text: 'A frog starts at 8 and hops forward 5.' },
      { type: 'figure', figureId: 'line' },
      { type: 'text', text: 'Where does the frog land?' },
    ],
    figures: [{ type: 'number_line', id: 'line', alt: 'A number line from 0 to 20 with a hop arrow from 8 forward by 5.', min: 0, max: 20, step: 1, labelEvery: 2, marks: [{ value: 8, label: 'start' }], jumps: [{ from: 8, to: 13, label: '+5' }] }],
    response: { type: 'numeric', answer: 13, misconceptionAnswers: [{ answer: 12, tag: 'counted_start_as_hop' }] },
    keyCheck: { value: '8 + 5' },
    hints: ['Count on from 8: 9, 10, …'],
    explanation: 'Count on 5 from 8: 9, 10, 11, 12, 13. The frog lands on 13, because $8 + 5 = 13$.',
  },
  {
    version: 1, id: 'fx-1-tens-ones', title: 'Build a number', skillIds: ['1.NBT.B.2'], difficulty: 3,
    prompt: [{ type: 'text', text: 'Each tall rod is a ten. Each small cube is a one.' }, { type: 'figure', figureId: 'blocks' }, { type: 'text', text: 'What number do the blocks show?' }],
    figures: [{ type: 'place_value_blocks', id: 'blocks', alt: 'Base-ten blocks: 4 rods of ten and 7 single cubes.', hundreds: 0, tens: 4, ones: 7 }],
    response: { type: 'numeric', answer: 47, misconceptionAnswers: [{ answer: 11, tag: 'counted_pieces' }, { answer: 74, tag: 'reversed_digits' }] },
    keyCheck: { value: '4*10 + 7' },
    explanation: '4 tens make 40, and 7 ones make 7. $40 + 7 = 47$.',
  },
  {
    version: 1, id: 'fx-2-coins', title: 'Pocket change', skillIds: ['2.MD.C.8'], difficulty: 5,
    prompt: [{ type: 'text', text: 'Sam empties a pocket and finds these coins.' }, { type: 'figure', figureId: 'coins' }, { type: 'text', text: 'How many cents does Sam have?' }],
    figures: [{
      type: 'money', id: 'coins', alt: 'Two quarters, one dime, one nickel and three pennies.',
      items: [{ kind: 'quarter', count: 2 }, { kind: 'dime', count: 1 }, { kind: 'nickel', count: 1 }, { kind: 'penny', count: 3 }],
    }],
    response: { type: 'numeric', answer: 68, unit: '¢', misconceptionAnswers: [{ answer: 7, tag: 'counted_coins' }] },
    keyCheck: { value: '2*25 + 10 + 5 + 3' },
    hints: ['Start with the coins worth the most: $25, 50$, …'],
    explanation: 'Count on from the biggest coins: 25, 50, then 60 with the dime, 65 with the nickel, then 66, 67, 68. Sam has 68¢.',
  },
  {
    version: 1, id: 'fx-2-ruler', title: 'How long is the pencil?', skillIds: ['2.MD.A.1'], difficulty: 3,
    prompt: [{ type: 'text', text: 'The pencil starts at the 0 mark.' }, { type: 'figure', figureId: 'ruler' }, { type: 'text', text: 'How long is it?' }],
    figures: [{ type: 'ruler', id: 'ruler', alt: 'An inch ruler from 0 to 8 with a pencil lying from 0 to 6.', unit: 'in', length: 8, subdivisions: 2, object: { from: 0, to: 6, label: 'pencil', color: 'gold' } }],
    response: { type: 'numeric', answer: 6, unit: 'in', misconceptionAnswers: [{ answer: 7, tag: 'counted_tick_marks' }] },
    keyCheck: { value: '6 - 0' },
    explanation: 'The pencil starts at 0 and ends at 6, so it is 6 inches long.',
  },
  {
    version: 1, id: 'fx-2-fruit-graph', title: 'Fruit vote', skillIds: ['2.MD.D.10'], difficulty: 4,
    prompt: [{ type: 'text', text: 'A class voted for their favorite fruit.' }, { type: 'figure', figureId: 'votes' }, { type: 'text', text: 'How many more students chose apples than pears?' }],
    figures: [{
      type: 'bar_chart', id: 'votes', title: 'Favorite fruit', alt: 'Bar graph of votes: apples 9, bananas 6, pears 4, grapes 7.', yLabel: 'Votes', yStep: 2, yMax: 10,
      bars: [{ label: 'Apples', value: 9 }, { label: 'Bananas', value: 6 }, { label: 'Pears', value: 4 }, { label: 'Grapes', value: 7 }],
    }],
    response: { type: 'numeric', answer: 5, misconceptionAnswers: [{ answer: 13, tag: 'added_instead' }, { answer: 9, tag: 'read_one_bar' }] },
    keyCheck: { value: '9 - 4' },
    hints: ['Find the top of the apples bar and the pears bar.'],
    explanation: 'Apples got 9 votes and pears got 4. $9 - 4 = 5$, so 5 more students chose apples.',
  },
  {
    version: 1, id: 'fx-2-order-numbers', title: 'Smallest to largest', skillIds: ['2.NBT.A.4'], difficulty: 4,
    prompt: [{ type: 'text', text: 'Put these numbers in order from smallest to largest.' }],
    response: { type: 'ordering', items: ['389', '398', '839', '893'], firstLabel: 'Smallest', lastLabel: 'Largest' },
    hints: ['Compare the hundreds first.'],
    explanation: 'Compare hundreds: 3 hundreds is less than 8 hundreds. Then compare tens: 389 has 8 tens and 398 has 9 tens. So the order is 389, 398, 839, 893.',
  },
  {
    version: 1, id: 'fx-2-array-addition', title: 'Rows of dots', skillIds: ['2.OA.C.4'], difficulty: 4,
    prompt: [{ type: 'text', text: 'Look at the rows of dots.' }, { type: 'figure', figureId: 'array' }, { type: 'text', text: 'Which addition matches the picture?' }],
    figures: [{ type: 'array_grid', id: 'array', alt: 'An array of dots in 3 rows with 5 dots in each row.', rows: 3, cols: 5, style: 'dots' }],
    response: {
      type: 'multiple_choice',
      options: [
        { text: '$5 + 5 + 5$', correct: true },
        { text: '$3 + 5$', correct: false, misconception: 'added_dimensions' },
        { text: '$3 + 3 + 3$', correct: false, misconception: 'wrong_repeated_group' },
        { text: '$5 + 3 + 5$', correct: false, misconception: 'mixed_groups' },
      ],
    },
    explanation: 'There are 3 rows and each row has 5 dots, so we add 5 three times: $5 + 5 + 5 = 15$.',
  },
];
