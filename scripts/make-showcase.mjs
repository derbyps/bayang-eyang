// Generates public/lakon/showcase.json: every action, style and modifier, labelled on screen.
// Run: node scripts/make-showcase.mjs
import { writeFileSync } from 'node:fs';

const beats = [];
const scenes = [];
let t = 0;

const SLOT = { stage: 2.4, gesture: 2.0, combat: 2.0, light: 2.4, gunungan: 3.6, enter: 2.2 };
const scene = (kind, title) => scenes.push({ id: title.toLowerCase().replace(/[^a-z]+/g, '-'), kind, title, start: +t.toFixed(2) });
const label = (b) => `${b.do} · ${b.style}${b.mods ? ' + ' + b.mods.join(' + ') : ''}`;
const at = () => +t.toFixed(2);

/** A labelled move; `slot` seconds pass before the next one. */
function move(b, slot, caption = label(b)) {
  const beat = { t: at(), ...b };
  if (b.do !== 'speak') beats.push({ t: at(), narrate: caption });
  beats.push(beat);
  t += slot;
}
/** An unlabelled helper move (entrances and exits between demonstrations). */
function quiet(b, slot) {
  beats.push({ t: at(), ...b });
  t += slot;
}

// 1. Stage
scene('jejer', 'Stage');
beats.push({ t: 0, music: 'calm' });
move({ actor: 'petruk', do: 'enter', style: 'glide', from: 'left', to: 0.5 }, SLOT.stage);
move({ actor: 'petruk', do: 'exit', style: 'glide' }, SLOT.stage);
move({ actor: 'petruk', do: 'enter', style: 'sneak', from: 'right', to: 0.55 }, SLOT.stage);
move({ actor: 'petruk', do: 'exit', style: 'flee' }, SLOT.stage);
move({ actor: 'petruk', do: 'enter', style: 'leap', from: 'left', to: 0.45 }, SLOT.stage);
move({ actor: 'petruk', do: 'plant', style: 'firm', to: 0.4 }, SLOT.stage);
move({ actor: 'petruk', do: 'plant', style: 'light', to: 0.55 }, SLOT.stage);
move({ actor: 'petruk', do: 'cross', style: 'walk', to: 0.3 }, SLOT.stage);
move({ actor: 'petruk', do: 'cross', style: 'hurry', to: 0.6 }, SLOT.stage);
move({ actor: 'petruk', do: 'exit', style: 'leap' }, SLOT.stage);

// 2. Gesture
scene('jejer', 'Gesture');
quiet({ actor: 'eyang', do: 'enter', style: 'glide', from: 'right', to: 0.72 }, 0.4);
quiet({ actor: 'petruk', do: 'enter', style: 'glide', from: 'left', to: 0.35 }, SLOT.enter);
move({ actor: 'petruk', do: 'speak', style: 'calm', line: '(speak · calm) Good evening, everyone.' }, SLOT.gesture + 0.6);
move({ actor: 'petruk', do: 'speak', style: 'animated', line: '(speak · animated) And what an evening it is!' }, SLOT.gesture + 1.2);
move({ actor: 'petruk', do: 'bow', style: 'sembah' }, SLOT.gesture);
move({ actor: 'petruk', do: 'bow', style: 'deep' }, SLOT.gesture);
move({ actor: 'petruk', do: 'point', style: 'accuse', target: 'eyang' }, SLOT.gesture);
move({ actor: 'petruk', do: 'point', style: 'guide', target: 'eyang' }, SLOT.gesture);
move({ actor: 'petruk', do: 'look-far', style: 'shade' }, SLOT.gesture);
move({ actor: 'petruk', do: 'look-far', style: 'peer' }, SLOT.gesture);
move({ actor: 'petruk', do: 'laugh', style: 'giggle' }, SLOT.gesture);
move({ actor: 'petruk', do: 'laugh', style: 'belly' }, SLOT.gesture);
move({ actor: 'petruk', do: 'weep', style: 'quiet' }, SLOT.gesture);
move({ actor: 'petruk', do: 'weep', style: 'sob' }, SLOT.gesture);
move({ actor: 'petruk', do: 'dance', style: 'kiprah' }, SLOT.gesture);
move({ actor: 'petruk', do: 'dance', style: 'sway' }, SLOT.gesture);
quiet({ actor: 'eyang', do: 'exit', style: 'glide' }, 1.6);

// 3. Combat
scene('perang', 'Combat');
beats.push({ t: at(), music: 'war' });
quiet({ actor: 'raksasa', do: 'enter', style: 'leap', from: 'right', to: 0.7 }, SLOT.enter);
move({ actor: 'petruk', do: 'attack', style: 'thrust', target: 'raksasa' }, SLOT.combat);
move({ actor: 'raksasa', do: 'dodge', style: 'hop' }, SLOT.combat);
move({ actor: 'petruk', do: 'attack', style: 'sweep', target: 'raksasa' }, SLOT.combat);
move({ actor: 'raksasa', do: 'dodge', style: 'duck' }, SLOT.combat);
move({ actor: 'petruk', do: 'attack', style: 'slam', target: 'raksasa' }, SLOT.combat);
move({ actor: 'raksasa', do: 'dodge', style: 'spin' }, SLOT.combat);
move({ actor: 'petruk', do: 'attack', style: 'kick', target: 'raksasa' }, SLOT.combat);
move({ actor: 'petruk', do: 'attack', style: 'grab', target: 'raksasa' }, SLOT.combat);
move({ actor: 'petruk', do: 'attack', style: 'charge', target: 'raksasa' }, SLOT.combat);
move({ actor: 'petruk', do: 'strike', style: 'jab', target: 'raksasa' }, SLOT.combat);
move({ actor: 'petruk', do: 'strike', style: 'chop', target: 'raksasa' }, SLOT.combat);
move({ actor: 'petruk', do: 'fling', style: 'spin', target: 'raksasa' }, SLOT.combat + 0.4);
quiet({ actor: 'raksasa', do: 'enter', style: 'glide', from: 'right', to: 0.7 }, SLOT.enter);
move({ actor: 'petruk', do: 'fling', style: 'arc', target: 'raksasa' }, SLOT.combat + 0.4);
quiet({ actor: 'raksasa', do: 'enter', style: 'sneak', from: 'right', to: 0.7 }, SLOT.enter);
move({ actor: 'raksasa', do: 'fall', style: 'crumple' }, SLOT.combat);
quiet({ actor: 'raksasa', do: 'enter', style: 'glide', from: 'right', to: 0.7 }, SLOT.enter);
move({ actor: 'raksasa', do: 'fall', style: 'flung-off' }, SLOT.combat);
quiet({ actor: 'raksasa', do: 'enter', style: 'leap', from: 'right', to: 0.7 }, SLOT.enter);
move({ actor: 'raksasa', do: 'fall', style: 'sink' }, SLOT.combat);

// 4. Modifiers
scene('perang', 'Modifiers');
quiet({ actor: 'raksasa', do: 'enter', style: 'glide', from: 'right', to: 0.72 }, SLOT.enter);
move({ actor: 'petruk', do: 'attack', style: 'thrust', target: 'raksasa', mods: ['feint'] }, SLOT.combat + 0.5);
move({ actor: 'petruk', do: 'strike', style: 'jab', target: 'raksasa', mods: ['double'] }, SLOT.combat + 0.5);
move({ actor: 'petruk', do: 'attack', style: 'sweep', target: 'raksasa', mods: ['miss'] }, SLOT.combat + 0.3);
move({ actor: 'petruk', do: 'strike', style: 'chop', target: 'raksasa', mods: ['high'] }, SLOT.combat);
move({ actor: 'petruk', do: 'attack', style: 'slam', target: 'raksasa', mods: ['low'] }, SLOT.combat);
move({ actor: 'petruk', do: 'attack', style: 'kick', target: 'raksasa', mods: ['low', 'miss'] }, SLOT.combat + 0.4);

// 5. Light and gunungan
scene('gunungan', 'Light & gunungan');
beats.push({ t: at(), music: 'calm' });
quiet({ actor: 'petruk', do: 'exit', style: 'glide' }, 0.6);
move({ actor: 'raksasa', do: 'loom', style: 'rise' }, SLOT.light);
move({ actor: 'raksasa', do: 'recede', style: 'drift' }, SLOT.light);
move({ actor: 'raksasa', do: 'loom', style: 'rush' }, SLOT.light);
move({ actor: 'raksasa', do: 'recede', style: 'snap' }, SLOT.light);
quiet({ actor: 'raksasa', do: 'exit', style: 'glide' }, 1.6);
quiet({ actor: 'gunungan', do: 'enter', style: 'glide', from: 'left', to: 0.5 }, SLOT.enter);
move({ actor: 'gunungan', do: 'gunungan-open', style: 'spin' }, SLOT.gunungan);
move({ actor: 'gunungan', do: 'gunungan-open', style: 'rise' }, SLOT.gunungan);
move({ actor: 'gunungan', do: 'gunungan-storm', style: 'wind' }, SLOT.gunungan);
move({ actor: 'gunungan', do: 'gunungan-storm', style: 'fire' }, SLOT.gunungan);
move({ actor: 'gunungan', do: 'gunungan-close', style: 'spin' }, SLOT.gunungan);
move({ actor: 'gunungan', do: 'gunungan-close', style: 'sink' }, SLOT.gunungan);
quiet({ actor: 'gunungan', do: 'exit', style: 'glide' }, 1.8);

// 6. Same move, four temperaments (same Petruk puppet, only the motion differs)
scene('perang', 'Four temperaments');
beats.push({ t: at(), music: 'war' });
const temps = [
  ['as-halus', 'halus', 0.14],
  ['as-gagah', 'gagah', 0.38],
  ['as-raksasa', 'raksasa', 0.62],
  ['as-punakawan', 'punakawan', 0.86],
];
for (const [id, , x] of temps) quiet({ actor: id, do: 'enter', style: 'glide', from: x < 0.5 ? 'left' : 'right', to: x }, 0.3);
t += 1.8;
for (let i = 0; i < temps.length; i++) {
  const [id, type] = temps[i];
  const target = temps[i === temps.length - 1 ? i - 1 : i + 1][0];
  move({ actor: id, do: 'attack', style: 'sweep', target }, 3.0, `attack · sweep — ${type}`);
}
for (const [id] of temps) quiet({ actor: id, do: 'exit', style: 'glide' }, 0.3);
t += 1.6;

// 7. Same move twice: the same kick never looks the same
scene('gara-gara', 'Same move twice');
beats.push({ t: at(), music: 'playful' });
quiet({ actor: 'petruk', do: 'enter', style: 'leap', from: 'left', to: 0.32 }, 0.3);
quiet({ actor: 'raksasa', do: 'enter', style: 'glide', from: 'right', to: 0.7 }, SLOT.enter);
move({ actor: 'petruk', do: 'attack', style: 'kick', target: 'raksasa' }, 2.4, 'attack · kick — first time');
move({ actor: 'petruk', do: 'laugh', style: 'giggle' }, 1.8);
move({ actor: 'petruk', do: 'attack', style: 'kick', target: 'raksasa' }, 2.6, 'attack · kick — again: new seed, bigger swing');

// 8. Ending
scene('tancep-kayon', 'Ending');
beats.push({ t: at(), music: 'calm' });
quiet({ actor: 'raksasa', do: 'exit', style: 'flee' }, 0.3);
quiet({ actor: 'petruk', do: 'exit', style: 'glide' }, 1.8);
quiet({ actor: 'eyang', do: 'enter', style: 'glide', from: 'left', to: 0.45 }, SLOT.enter);
move({ actor: 'eyang', do: 'linger', style: 'fade' }, 4);
beats.push({ t: at() - 4, sfx: 'gong' });
beats.sort((a, b) => a.t - b.t);

const lakon = {
  version: 1,
  title: 'Sabetan Gallery',
  seed: 51,
  cast: [
    { id: 'petruk', puppet: 'petruk', name: 'Petruk', type: 'punakawan' },
    { id: 'eyang', puppet: 'eyang-putri', name: 'Eyang Putri', type: 'halus' },
    { id: 'raksasa', puppet: 'raksasa', name: 'Raksasa', type: 'raksasa' },
    { id: 'gunungan', puppet: 'gunungan', name: 'Gunungan', type: 'gagah' },
    ...temps.map(([id, type]) => ({ id, puppet: 'petruk', name: `Petruk (${type})`, type })),
  ],
  scenes,
  beats,
};
writeFileSync(new URL('../public/lakon/showcase.json', import.meta.url), JSON.stringify(lakon, null, 2) + '\n');
console.log(`showcase: ${beats.length} beats, ends at ${t.toFixed(1)} s`);
