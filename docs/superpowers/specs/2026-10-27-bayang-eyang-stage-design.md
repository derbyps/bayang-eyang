# Bayang Eyang — Stage & Lakon Format (Sub-project 1) Design

- **Date:** 2026-10-27
- **Status:** Draft for review
- **Deadline context:** DEV Hacktoberfest Open-Source AI Challenge Week 4 ("Ghost in the Machine"), submissions due 2026-10-31 06:59 UTC (13:59 WIB). Target submit: 2026-10-31 ~10:00 WIB.

## 1. Intent

**Bayang Eyang** ("grandparent's shadow") turns a story about someone you love into a live wayang kulit shadow play. An open-weight model acts as the **dalang** (puppet master): it writes the play as a structured script. The browser performs that script live as a shadow play.

The whole product is split into three sub-projects:

1. **Stage + lakon format** (this spec): a shadow theatre that performs a JSON script.
2. **The dalang**: Gemma turns a family story into a valid script (next spec).
3. **Input, casting screen, video export, deploy** (later spec).

### What the user asked for
- AI is the core of the product. The stage exists to perform what the AI writes.
- A delightful UI and animation, with a wow factor, for a broad non-technical audience.
- Rich movement variety: many actions, several styles per action, and repeated moves that never look identical.
- The user's brand colors are used according to their stated roles.
- No "AI-looking" UI: no chat bubbles, no sparkle icons, no AI labels on the stage.

### Success criteria for this sub-project
- A viewer watching the ~60 s demo recognizes it as wayang kulit and finds it beautiful.
- The script format can express a full play, so the dalang (sub-project 2) only needs to produce valid JSON.
- Every action in the vocabulary appears in the demo script, and every one renders correctly.
- Playback is deterministic: the same script and time always produce the same frame and the same sound cues.

## 2. Scope

**In scope:** the script schema and validator, the choreographer, puppet rigs (6 puppets), the canvas renderer, synthesized sound, the clock, controls, captions, the lamp intro, the end card, the developer panel, a hand-written demo script, and tests.

**Out of scope (later sub-projects):** the AI script writer, story input, the casting screen, voice narration (TTS), video export, deployment, and the "dalang's side" painted-puppet view.

The interfaces are designed so these can plug in later. In particular, export only needs `frame(t)` and the audio graph, and the dalang only needs the schema and the validator's error messages.

## 3. Architecture

Core rule: **the stage is a pure function of time.** `render(timeline, t)` always draws the same frame for the same inputs. Sound cues are derived from the same timeline.

```
lakon.json → [1 Script check] → [2 Choreographer] → Timeline
                                                    ├→ [4 Renderer] frame(t) → canvas
                                                    └→ [5 Sound] cues(t) → Web Audio
                         [6 Clock] drives t for both · [7 Controls/Captions] read clock + timeline
```

| # | Unit | Responsibility | Depends on | Pure? |
|---|---|---|---|---|
| 1 | `script/` | Zod schema plus semantic validation rules. Returns typed `Lakon` or a list of human-readable errors (these get fed back to the dalang in sub-project 2). | none | yes |
| 2 | `choreo/` | Compiles beats into per-actor pose tracks. Applies the template, style, temperament, modifiers, seeded variation and escalation. Also produces a cue list (sfx, music, captions). | 1, 3 | yes |
| 3 | `rigs/` | Puppet data: silhouette paths, perforation patterns, joint pivots, rod anchors, temperament. | none | data |
| 4 | `stage/` | Draws one frame: screen, light, shadows, depth blur, rods, gunungan. | 2, 3 | given ctx |
| 5 | `audio/` | Synthesized cempala, keprak and gamelan, scheduled from cues. | 2, 6 | no |
| 6 | `clock/` | Play, pause, seek and rate. The single source of `t`. | none | mostly |
| 7 | `ui/` | Lamp intro, controls bar, scene-marked scrubber, captions, end card, developer panel. | 2, 6 | no |

**Stack:** Vite + TypeScript (strict), Zod, Vitest, Playwright (screenshots), Canvas 2D, Web Audio. No UI framework. Fonts are self-hosted via `@fontsource` so the app works offline.

### File layout
```
bayang-eyang/
  index.html
  src/main.ts
  src/script/{schema.ts, validate.ts, vocabulary.ts}
  src/choreo/{compile.ts, templates.ts, temperament.ts, modifiers.ts, rng.ts, pose.ts, cues.ts}
  src/rigs/{index.ts, gunungan.ts, semar.ts, petruk.ts, bagong.ts, raksasa.ts, eyang-putri.ts}
  src/stage/{render.ts, light.ts, puppet.ts, screen.ts, depth.ts}
  src/audio/{engine.ts, instruments.ts, patterns.ts}
  src/clock/clock.ts
  src/ui/{lamp-intro.ts, controls.ts, scrubber.ts, captions.ts, end-card.ts, debug-panel.ts, tokens.css}
  public/lakon/demo-eyang-putri.json
  tests/{script, choreo, clock, depth}/*.test.ts
  tests/visual/*.spec.ts
```

## 4. The lakon format

```ts
type Temperament = 'halus' | 'gagah' | 'raksasa' | 'punakawan';
type SceneKind = 'gunungan' | 'jejer' | 'perang' | 'gara-gara' | 'tancep-kayon';
type Side = 'left' | 'right';

interface Lakon {
  version: 1;
  title: string;
  seed: number;                          // base seed for all variation
  cast: CastMember[];
  scenes: { id: string; kind: SceneKind; title: string; start: number }[];  // start in seconds
  beats: Beat[];                         // sorted by t
}

interface CastMember {
  id: string;            // e.g. "eyang"
  puppet: PuppetKey;     // which rig: gunungan | semar | petruk | bagong | raksasa | eyang-putri
  name: string;          // display name in captions, e.g. "Eyang Putri"
  type: Temperament;     // overrides the rig's default temperament if given
  home?: Side;           // side the puppet faces from / is planted on
}

type Beat = ActionBeat | NarrateBeat | SfxBeat | MusicBeat;

interface ActionBeat {
  t: number;
  actor: string;                 // cast id
  do: Action;
  style?: Style;                 // must be valid for `do`; default = first style
  target?: string;               // cast id; required for attack, strike, fling, point
  from?: Side;                   // for enter
  to?: number;                   // x position 0..1 for cross / plant
  intensity?: number;            // 0..1, default 0.6
  speed?: 'slow' | 'normal' | 'fast';
  mods?: Modifier[];             // combat only
  line?: string;                 // for speak: the caption text
}
interface NarrateBeat { t: number; narrate: string }           // narrator caption
interface SfxBeat     { t: number; sfx: 'cempala-1' | 'cempala-2' | 'cempala-roll' | 'keprak' | 'gong' }
interface MusicBeat   { t: number; music: 'calm' | 'war' | 'playful' | 'stop' }
```

Caption text can mark Javanese terms as `[[term|meaning]]`, for example `[[sembah|a bow of respect, palms joined]]`. Captions render the term with a dotted purple underline and show the meaning on hover or tap.

### Action vocabulary (closed list)

| Group | `do` | Styles (first = default) | Needs |
|---|---|---|---|
| Stage | `enter` | glide, sneak, leap | `from` |
| | `exit` | glide, flee, leap | |
| | `plant` | firm, light | `to?` |
| | `cross` | walk, hurry | `to` |
| Gesture | `speak` | calm, animated | `line` |
| | `bow` | sembah, deep | |
| | `point` | accuse, guide | `target` |
| | `look-far` | shade, peer | |
| | `laugh` | giggle, belly | |
| | `weep` | quiet, sob | |
| | `dance` | kiprah, sway | |
| Combat | `attack` | thrust, sweep, slam, kick, grab, charge | `target` |
| | `strike` | jab, chop | `target` |
| | `dodge` | hop, duck, spin | |
| | `fling` | spin, arc | `target` |
| | `fall` | crumple, flung-off, sink | |
| Light | `loom` | rise, rush | |
| | `recede` | drift, snap | |
| Gunungan | `gunungan-open` | spin, rise | actor must be a gunungan |
| | `gunungan-close` | spin, sink | actor must be a gunungan |
| | `gunungan-storm` | wind, fire | actor must be a gunungan |
| Ending | `linger` | fade | |

**Modifiers** (`attack` and `strike` only): `feint`, `double`, `miss`, `high`, `low`. `high` and `low` are mutually exclusive.

### Validation rules (script check)
1. The input matches the Zod schema. Unknown keys are rejected.
2. `beats` are sorted by `t`, and every `t` falls within `[0, 300]`.
3. Every `actor` and `target` exists in `cast`. A `target` is never the actor itself.
4. `style` is valid for `do`. Required fields per action are present (see table).
5. Gunungan actions are only used by gunungan puppets. Gunungan puppets only use `enter`, `exit`, `plant` and gunungan actions.
6. On-stage state: every action except `enter` requires the actor to be on stage. `enter` requires the actor to be off stage. A `fall` or `exit` removes the actor from the stage, and so does being the target of a `fling`, which ends in an implicit `fall/flung-off`. A `target` must be on stage. `linger` must be the actor's last beat.
7. **Anti-repeat:** an actor's beat must not have the same `do` and `style` as that actor's previous action beat.
8. Modifiers are only allowed on `attack` and `strike`, with no duplicates, and `high` and `low` never together.
9. `intensity` falls within [0, 1]. `scenes[].start` values are ascending, and the first one is 0.

Each error includes the beat index, the rule and a plain sentence, e.g. `beat 14: "petruk" uses attack/kick twice in a row — choose a different style or action`.

## 5. Motion system

**Category:** a rare, watch-once performance where delight is the purpose. Puppet motion may be long and expressive. UI controls follow UI rules: 150–250 ms, `cubic-bezier(0.23, 1, 0.32, 1)` ease-out, `transform`/`opacity` only, and hover effects gated with `(hover: hover) and (pointer: fine)`.

### Rig and pose
Each puppet has a rigid body and two arms (back and front), each with a shoulder and an elbow joint, driven by rods.

```ts
interface Pose { x: number; y: number; tilt: number; depth: number;   // depth 0..0.6
                 shoulderBack: number; elbowBack: number; shoulderFront: number; elbowFront: number;
                 flipX: number; opacity: number }                       // flipX -1..1 (gunungan spin, facing)
```

### Templates
Each action+style is a template made of four phases: **anticipation → action → follow-through → settle**. Each phase has a relative duration, a target pose delta and an easing curve. Easings are:
- Travel: strong ease-in-out `cubic-bezier(0.77, 0, 0.175, 1)`
- Entrances: ease-out `cubic-bezier(0.23, 1, 0.32, 1)`
- Impacts: a short linear snap

### Temperament profiles (starting values, to be tuned by feel)
| Type | timeScale | amplitude | overshoot | arm spring (stiffness/damping) | jitter |
|---|---|---|---|---|---|
| halus | 1.3 | 0.8 | 0 | 120 / 20 | 0.5× |
| gagah | 1.0 | 1.0 | 0.08 | 170 / 16 | 1× |
| raksasa | 1.2 | 1.25 | 0.15 | 90 / 9 | 1.2× |
| punakawan | 0.85 | 1.15 | 0.12 | 220 / 8 | 1.5× |

Arms follow body motion through a damped spring (secondary motion). The spring is simulated at a fixed step inside the choreographer, so results are deterministic.

### Variation
- **Seeded RNG:** mulberry32 seeded with `hash(lakon.seed, actorId, actorMoveIndex)`. Timing varies ±8% × jitter and angles ±5° × jitter. Same script means the same result, and different moves get different results.
- **Escalation:** the nth combat beat of the same actor gets intensity × (1 + 0.15·n), capped at 1.
- **Modifiers:**
  - `feint` inserts a partial anticipation and a pull-back.
  - `double` repeats the action phase with seed + 1.
  - `miss` offsets the target by 0.08 screen width and replaces the follow-through with a stumble.
  - `high` / `low` offset the shoulder and elbow angles by ±20° / ±15°.
- **Idle life:** planted puppets sway 0.4–0.8° at around 0.3 Hz (seeded phase). `speak` adds a 2 px bob at about 4 Hz for the line's duration (estimated at 14 characters per second, minimum 1.5 s).
- **Targets react:** `strike` and a successful `attack` add a recoil to the target. `fling` drives the target with the style's trajectory and ends with an implicit `fall/flung-off`.

### Light and depth
- Lamp at the top-center. Puppet shadow scale is `1 / (1 − depth)`, blur is `depth × 24 px` and opacity is `1 − depth × 0.6`.
- `loom` animates depth toward 0.5. `recede` animates it back toward 0.
- **Flicker:** the sum of two seeded low-frequency noise channels, at most 2 Hz. Brightness varies ±6% and the lamp position jitters ±2 px. Shadows move by the opposite offset (parallax). Everything stays below 3 changes per second (photosensitivity safety, WCAG 2.3.1).
- **Gunungan:** `spin` animates `flipX` −1 → 1 with a slight vertical rise. `storm` is a rotational tremble of ±4° at about 6 Hz with low amplitude.
- **Linger:** after the closing gunungan, the lamp dims to 70%. The chosen actor's shadow holds for 1.2 s, then over 1.5 s its blur rises 0 → 8 px and opacity falls 1 → 0 with ease-out.

### Reduced motion (`prefers-reduced-motion: reduce`)
- No flicker and no storm tremble.
- `loom` becomes a blur-only crossfade with no scale change.
- Combat amplitude is reduced to 0.5×.
- Idle sway is off.
- Captions, sound and story order are unchanged.

## 6. Look

| Element | Treatment |
|---|---|
| Page background | Near-black, warm: `#0B0907` |
| Screen (kelir) | Radial light from the lamp: Yellow `#FFC300` core → Orange `#FF6B35` → dark edges, over a faint generated cloth-weave noise at ~4% alpha |
| Screen trim | Thin top and bottom bands in Teal `#0F4C5C` |
| Banana trunk | A dark band at the bottom of the screen where puppets are planted |
| Shadows | `#1A0F08`. Perforations (lace holes) are cut with even-odd fill, so the lamp light shows through |
| Rods | 1.5 px lines in shadow tone from the hand and body anchors down past the bottom edge |
| Captions | Narration in Cormorant Garamond italic. Speaker names in Yellow small caps. Javanese terms with a dotted Purple underline (the text itself stays light for contrast) |
| UI type | Instrument Sans |

**Brand color roles (from the user):**
- Purple `#9D4EDD`, primary: play/pause and *Watch again*, the active scene marker, the Javanese-term underline
- Yellow `#FFC300`, critical CTA and highlight: *Light the lamp* and its flame, the lamp core, speaker names
- Orange `#FF6B35`, secondary, hover and progress: scrubber progress, hover states, the caption and sound toggles, the outer lamp glow
- Teal `#0F4C5C`, structure: screen trim, control-bar border and faint background, developer panel, secondary icons

**Brand signature:** the end card shows a small ink line-art gunungan with the four accents as tiny highlights, and a quiet `@derbyps.dev` credit.

Not allowed: chat bubbles, sparkle icons, gradient cards, or any "AI" label on the stage.

### Screens and flow
1. **Lamp intro:** a dark screen with a small Yellow flame and *Nyalakan blencong · Light the lamp*. Clicking it starts the AudioContext (satisfying the browser's autoplay policy), the lamp flickers up over ~1.2 s, and playback begins.
2. **Performance:**
   - A 16:9 stage, letterboxed. Captions are at the bottom.
   - The controls auto-hide after 2.5 s without pointer movement and fade back in over 200 ms on movement.
   - The scrubber shows scene markers (Gunungan · Jejer · Perang · Gara-gara · Tancep kayon). Clicking a marker seeks to that scene.
3. **End card:** it appears after the linger and shows *Bayang Eyang*, *Watch again* and the brand signature.

**Developer panel:** toggled with `D` and hidden by default. It shows the script beats with the current beat highlighted, the current `t`, the FPS and validation status.

**Responsive:** desktop-first, and landscape phones are supported. Portrait phones show a "rotate your phone" hint with a small gunungan icon.

## 7. Sound

All sound is synthesized with Web Audio. There are no samples, so there are no licensing issues and it works offline.

| Sound | Synthesis | Use |
|---|---|---|
| `cempala-1/2/roll` | Noise burst → band-pass ~1 kHz, 60 ms decay, plus a 180 Hz sine thump | Entrances, accents, fights |
| `keprak` | Several short high-band-pass noise and metallic partials, 3–6 kHz, ~150 ms | Strikes, flings, dramatic beats |
| `gong` | Low sine (~50 Hz) with a slightly detuned partner for beating, long decay | Scene openings and the ending |
| Gamelan | Metallophone voice (inharmonic partials) in the slendro scale. Patterns: `calm` (slow), `war` (fast), `playful` | Scene underscore |

The choreographer also adds implicit cues: `enter` → `cempala-1`, `strike` or a successful `attack` → `keprak`, `fling` → `cempala-roll`. Explicit `sfx` beats add to these. On seek, all scheduled audio is cancelled and rescheduled from the new `t`. There is a master gain, and the mute toggle ramps over 150 ms.

A licensed gamelan recording may replace the synthesized gamelan later. That change is not needed for this sub-project.

## 8. Demo script (`demo-eyang-putri.json`, ~60 s, fictional story)

This is a fictional "Eyang Putri" who left her village in 1965 with only a rice tin. No real personal data is used.

| Scene | t | Beats (actor: do/style [+mods]) |
|---|---|---|
| Gunungan | 0–6 | gunungan: enter, gunungan-open/spin, gunungan-storm/wind, exit; music calm; gong |
| Jejer | 6–18 | eyang: enter/glide, plant/firm, bow/sembah, weep/quiet (narration: leaving the village); semar: enter/sneak, speak/calm, cross/walk |
| Perang | 18–36 | music war; raksasa: enter/leap, loom/rise, recede/drift, dance/kiprah, attack/slam → eyang: dodge/hop; raksasa: attack/grab +feint; eyang: point/accuse, strike/jab, fling/spin (raksasa is flung off; implicit fall/flung-off) |
| Gara-gara | 36–52 | music playful; petruk: enter/leap, look-far/shade, laugh/belly, speak/animated (the rice-tin joke); bagong: enter/glide, attack/kick +low +miss, fall/crumple (comic pratfall); petruk: laugh/giggle, exit/flee |
| Tancep kayon | 52–60 | gunungan: enter, gunungan-close/spin; semar: exit; eyang: linger/fade; gong |

The final JSON must pass every validation rule, and it must use every action in the vocabulary at least once. The style variety listed here is a minimum, and the remaining styles can be used where they fit.

## 9. Puppets

| Puppet | Source | Temperament |
|---|---|---|
| Gunungan | Traced from a reuse-licensed wayang image | n/a |
| Semar | Traced | punakawan |
| Petruk | Traced | punakawan |
| Raksasa (giant) | Traced | raksasa |
| Eyang Putri | Stylized SVG (putri halus proportions, profile face) | halus |
| Bagong | Stylized SVG | punakawan |

**Fallback:** if suitable reuse-licensed sources are not found within ~1 hour, all six are drawn in stylized SVG, and the traced versions are swapped in later. Rigs keep the same joint and anchor structure either way. Every traced source is credited in the README with its license.

## 10. Testing

**Unit tests (Vitest), written test-first:**
- **script:** valid demo passes. One failing case per validation rule, each producing the expected error message.
- **choreo:**
  - Determinism: compiling twice gives deep-equal results.
  - Two identical-style moves by the same actor produce different tracks.
  - Escalation raises intensity.
  - Each modifier inserts or alters the expected phases.
  - Temperament scales durations.
  - The cue list contains the implicit cues.
- **depth:** the scale, blur and opacity formulas.
- **clock:** play, pause, seek and rate arithmetic, using an injected time source.

**Visual (Playwright):**
- Screenshots at fixed `t` values: lamp-intro, the gunungan mid-spin, the giant looming (`t ≈ 24.5`), the gara-gara miss, and the linger.
- These are compared against approved baselines and reused as DEV post images.

**Manual feel check:** watch at 0.5× rate and frame by frame, and check smoothness on a real phone in landscape. Tune the temperament values accordingly.

## 11. Acceptance criteria

1. `npm test` passes, and `npm run build` produces a static site that works offline after the first load.
2. The demo script validates and uses all 22 actions. Playback runs at ~60 fps on a recent laptop, with no dropped frames visible during the perang.
3. Seeking to any scene marker shows the correct frame and the correct sound from there.
4. Reduced-motion mode works as described in §5.
5. The brand color roles are applied as described in §6, and nothing on the stage looks like a chatbot.
6. The README lists credits and licenses for any traced puppet sources.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Tracing sources and licenses take too long | Time-box to 1 h, then use the stylized fallback |
| Synthesized gamelan sounds cheap | Keep it quiet and sparse, and let knocks carry the rhythm. Swap in a recording later. |
| Canvas blur cost on phones | Cap the blur radius, cache each puppet's silhouette to an offscreen canvas, and only blur actors with depth > 0 |
| Feel needs more tuning than planned | Temperament values live in one table, so feel can be tuned there without touching templates |
| Cultural inaccuracy | Get the terms and character use checked by a Javanese speaker before the post, and credit them |
