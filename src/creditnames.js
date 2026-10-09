// settle-see · credits names - the credits family's names, notes and teaching order, registered as a LAZY family:
// the names and notes are known at once, the drawings (creditshapes.js, about 19 kB) load the first time one is needed.
//
// <claudes_code_comments>
// ** Function List **
// NOTES               - each credits shape's one-line description (describe() returns it before the drawing loads)
// KANERVA             - the six shapes of Kanerva's sparse distributed memory, in their teaching order
// CREDIT_NAMES        - every credits shape's name, in the family's order
// loadCreditShapes()  - import the drawings (creditshapes.js); resolves to that module once every shape is registered
//
// ** Technical Review **
// - Lane LAUNCHGATES (2026-10-09) split the family so a page that never draws a credits shape never fetches its
//   drawings: settle-site's entry chunk carried creditshapes.js (18,718 B) on every page through this package's
//   index. The site's hero deals eight credits shapes as stills and #/credits draws all 26, so the drawings are not
//   dead weight, only late: mount.js shows an unlit field for a pending shape and settles to it when it arrives,
//   and starts the load as soon as an item names one.
// - toTarget() refuses a pending shape by name (it cannot draw what has not arrived); loadTarget() and ensureShape()
//   wait for it. A caller that needs the drawings synchronously imports creditshapes.js itself (package export
//   'settle-see/credits'), which registers them at import.
// - The names here and the keys of CREDIT_SHAPES are held equal by tests/creditlazy.test.mjs.
// </claudes_code_comments>

import { defineLazy } from './shapes.js';

export const NOTES = {
  hardLocations: 'hard locations: a few thousand addresses chosen at random in a huge space',
  hammingBall: 'a cue and the Hamming ball of locations it wakes',
  counters: 'writing: each woken location adds +1 or -1 to its counters',
  vote: 'reading is a vote: the woken locations vote on each bit',
  criticalDistance: 'the critical distance: nearer, reading again converges; farther, it wanders off',
  tesseract: 'the binary hypercube: every corner an address, every edge one bit flipped',
  isingDomains: 'two Ising domains of aligned spins meeting at a wall',
  tanhRule: 'the single-flip rule P(yes) = (1 + tanh I) / 2',
  boltzmannBars: 'Boltzmann weights e^(-E/T) falling over the energy levels',
  metropolisHop: 'an energy landscape and a proposed hop over the barrier',
  restoredDisc: 'a picture restored: noise on the left, clean on the right',
  annealValley: 'a rugged landscape and the deepest valley slow cooling finds',
  hopfieldNet: 'a Hopfield net: six units, every pair pulled',
  boltzmannMachine: 'a Boltzmann machine: visible units below, hidden above',
  pbitCoin: 'a p-bit: a coin with a lean',
  tapField: 'mean-field leans, each light sized by its average',
  tannerGraph: 'a Tanner graph: parity checks above, bits below',
  softmaxRead: 'a softened read: a softmax peaked on the nearest pattern',
  markovBlanket: 'a Markov blanket: inside, the blanket, the world outside',
  noisyWell: 'noise as a resource: a jittering path in a smooth well',
  pbitChip: 'a chip of p-bits: a die with pins and cells',
  openBook: 'an open book and its lines of prose',
  vinyl: 'a record, its grooves and its label',
  railsAerobics: 'an aerobics figure on a pair of rails',
  dots: 'polka dots',
  musicMachine: 'a small music-making machine with notes leaving it',
};

export const KANERVA = ['hardLocations', 'hammingBall', 'counters', 'vote', 'criticalDistance', 'tesseract'];

export const CREDIT_NAMES = Object.keys(NOTES);

export const loadCreditShapes = () => import('./creditshapes.js');

defineLazy(CREDIT_NAMES, NOTES, 'credits', loadCreditShapes);
