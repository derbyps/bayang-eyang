# Bayang Eyang Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser shadow theatre that validates a lakon JSON script and performs it live as a wayang kulit play, with a ~60 s story demo and a ~3 min showcase of every move.

**Architecture:** The pipeline is a pure one: `validateLakon → compile → Timeline`. `compile` pre-bakes every actor's pose into a 120 Hz sample buffer, so `samplePose(timeline, id, t)` is a cheap, deterministic lookup. The Canvas 2D renderer and the Web Audio scheduler both read the Timeline, and a single clock drives both.

**Tech Stack:** Vite, TypeScript (strict), Zod, Vitest, Playwright, Canvas 2D, Web Audio, `@fontsource/cormorant-garamond`, `@fontsource/instrument-sans`. No UI framework.

**Spec:** `docs/superpowers/specs/2026-10-27-bayang-eyang-stage-design.md` (read §4–§9 before any task)

## Global Constraints

- TypeScript `strict: true`. Code, comments and commit messages are in English.
- Commits use conventional style (`feat:`, `test:`, `docs:`) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never add a Claude-Session trailer.
- Runtime deps are limited to `zod` and the two `@fontsource` packages. Dev deps: `vite`, `typescript`, `vitest`, `@playwright/test`.
- Brand colors and roles: Purple `#9D4EDD` (primary buttons, active state, term underline), Yellow `#FFC300` (critical CTA, lamp core, speaker names), Orange `#FF6B35` (secondary/hover/progress, outer glow), Teal `#0F4C5C` (structure: trim, borders, dev panel). Page `#0B0907`, shadow `#1A0F08`.
- Easings: ease-out `cubic-bezier(0.23, 1, 0.32, 1)`, ease-in-out `cubic-bezier(0.77, 0, 0.175, 1)`.
- UI controls animate only `transform` and `opacity`, at 150–250 ms with ease-out. Hover effects are gated by `@media (hover: hover) and (pointer: fine)`.
- Depth: `scale = 1/(1−depth)`, `blur = depth×24px`, `opacity = 1−depth×0.6`, depth ∈ [0, 0.6].
- Flicker: at most 2 Hz content, brightness ±6%, lamp jitter ±2 px, shadows offset opposite. Under reduced motion: no flicker.
- Variation: timing ±8%×jitter, angles ±5°×jitter. Escalation is ×(1 + 0.15·n), capped at intensity 1.
- Stage coordinates: x ∈ [0,1] left→right and y ∈ [0,1] top→bottom on the 16:9 screen. The banana trunk top (puppet feet line) is y = 0.86. The lamp is at (0.5, −0.1).
- UI tasks (10, 11) apply the `animate`, `emil-design-eng` and `impeccable` skill guidance. No chat bubbles, no sparkle icons, no "AI" labels.

## Review Focus

1. **Overlapping beats for one actor** (a new beat starts before the previous finishes): the new beat should start from the actor's current pose with no snap. → Task 5, `test("overlapping beat retargets without a jump")`.
2. **Seeking while sound is scheduled** (scrubbing back and forth): sounds must not double up or hang. Only cues at or after the new `t` play. → Task 9, `test("seek cancels and reschedules only future cues")`.
3. **Background tab, then return** (rAF paused, wall clock jumped): playback continues from where it was and does not fire every skipped cue in a burst. → Task 7, `test("large frame gap does not advance more than maxStep")`, and Task 9's window test.
4. **Invalid or missing script at `?lakon=`**: a friendly on-stage message plus the validation errors in the dev panel, not a blank page. → Task 11, `test("bad script shows message and errors")` (Playwright).
5. **Resize or rotation mid-play**: the stage stays letterboxed 16:9 and crisp at the device pixel ratio. → Task 8, `test("fitStage letterboxes 16:9")`.

---

### Task 1: Scaffold, vocabulary and schema

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.ts` (placeholder), `src/script/vocabulary.ts`, `src/script/schema.ts`
- Test: `tests/script/schema.test.ts`, `tests/script/vocabulary.test.ts`

**Interfaces:**
- Produces:
  - `type Action` (22 literals from spec §4), `type Modifier = 'feint'|'double'|'miss'|'high'|'low'`, `type Temperament`, `type SceneKind`, `type Side`, `type PuppetKey = 'gunungan'|'semar'|'petruk'|'bagong'|'raksasa'|'eyang-putri'`
  - `ACTIONS: Record<Action, { group: 'stage'|'gesture'|'combat'|'light'|'gunungan'|'ending'; styles: readonly [string, ...string[]]; needs: ('from'|'to'|'target'|'line')[] }>`, with exact styles from the spec table (first = default)
  - `COMBAT_MOD_ACTIONS = ['attack','strike'] as const`
  - `LakonSchema` (Zod, `.strict()` on every object), `type Lakon = z.infer<typeof LakonSchema>`, plus `Beat`, `ActionBeat`, `NarrateBeat`, `SfxBeat`, `MusicBeat`, `CastMember`
  - `isActionBeat(b: Beat): b is ActionBeat`

- [ ] **Step 1:** `npm create vite@latest . -- --template vanilla-ts`. Add `zod`, `vitest` and the `test` script (`vitest run`). Remove the template demo code. Set `strict: true`.
- [ ] **Step 2: Write failing tests**
  - `vocabulary.test.ts`: `Object.keys(ACTIONS).length === 22`; the total style count across actions `=== 51`; `ACTIONS.attack.styles` equals `['thrust','sweep','slam','kick','grab','charge']`; `ACTIONS.enter.needs` contains `'from'`.
  - `schema.test.ts`: a minimal lakon (1 cast, 1 scene at 0, 1 enter beat) parses; an unknown key on a beat fails; `intensity: 1.5` fails; a beat with both `do` and `narrate` fails.
- [ ] **Step 3:** Run `npm test`. Expected: FAIL (modules missing).
- [ ] **Step 4:** Implement `vocabulary.ts` and `schema.ts`. `Beat` is a `z.union` of four strict objects. `style` stays a `z.string()` here; style validity is checked in Task 2.
- [ ] **Step 5:** Run `npm test`. Expected: PASS.
- [ ] **Step 6:** Commit `feat: scaffold project with lakon vocabulary and schema`.

### Task 2: Semantic validator

**Files:**
- Create: `src/script/validate.ts`
- Test: `tests/script/validate.test.ts`

**Interfaces:**
- Consumes: `LakonSchema`, `ACTIONS`, `isActionBeat` (Task 1)
- Produces:
  - `validateLakon(input: unknown): { ok: true; lakon: Lakon } | { ok: false; errors: ValidationError[] }`
  - `interface ValidationError { beat?: number; rule: RuleId; message: string }`
  - `type RuleId = 'schema'|'order'|'cast'|'style'|'needs'|'gunungan'|'on-stage'|'repeat'|'mods'|'range'`

- [ ] **Step 1: Write failing tests**, one per spec §4 rule, each building on a valid `base()` fixture:
  - `order`: beat `t` decreasing → error with rule `order`
  - `cast`: actor `"ghost"` → `cast`; target equal to the actor → `cast`
  - `style`: `attack` with `style: 'moonwalk'` → `style`; missing style → OK (default)
  - `needs`: `attack` without `target` → `needs`; `speak` without `line` → `needs`
  - `gunungan`: semar doing `gunungan-open` → `gunungan`; gunungan doing `laugh` → `gunungan`
  - `on-stage`: `laugh` before `enter` → `on-stage`; `enter` twice → `on-stage`; an actor acting after being the target of a `fling` → `on-stage`; a beat after `linger` → `on-stage`
  - `repeat`: the same actor doing `attack/kick` then `attack/kick` → `repeat`, with message exactly `beat 2: "petruk" uses attack/kick twice in a row — choose a different style or action`; `attack/kick`, `laugh`, `attack/kick` → OK
  - `mods`: `mods` on `laugh` → `mods`; `['high','low']` → `mods`; `['miss','miss']` → `mods`
  - `range`: `t: 301` → `range`; a first scene start ≠ 0 → `range`
  - Schema failure → a single error with rule `schema`, and the message includes the Zod path
- [ ] **Step 2:** Run `npx vitest run tests/script/validate.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `validateLakon`: parse with Zod, then make one pass over beats keeping `onStage: Set<string>` and `lastAction: Map<actor, 'do/style'>`. Resolve the default style before the repeat check. Collect all errors; don't stop at the first.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat: validate lakon scripts with readable errors`.

### Task 3: Math utilities (rng, easing, temperament, depth, pose)

**Files:**
- Create: `src/choreo/rng.ts`, `src/choreo/easing.ts`, `src/choreo/temperament.ts`, `src/choreo/pose.ts`, `src/stage/depth.ts`
- Test: `tests/choreo/math.test.ts`, `tests/depth/depth.test.ts`

**Interfaces:**
- Produces:
  - `hashSeed(...parts: (string|number)[]): number` (32-bit FNV-1a); `mulberry32(seed: number): () => number` (values in [0,1))
  - `cubicBezier(x1,y1,x2,y2): (t: number) => number`; `EASE: { out; inOut; linear; snap }` (`snap` = linear)
  - `TEMPERAMENTS: Record<Temperament, { timeScale; amplitude; overshoot; arm: { stiffness; damping }; jitter }>` with spec §5 values (jitter: halus 0.5, gagah 1, raksasa 1.2, punakawan 1.5)
  - `interface Pose { x; y; tilt; depth; shoulderBack; elbowBack; shoulderFront; elbowFront; flipX; opacity }` (angles in degrees); `REST_POSE: Pose`; `lerpPose(a, b, k): Pose`
  - `depthToShadow(depth: number): { scale; blur; opacity }` (clamps depth to [0, 0.6])

- [ ] **Step 1: Write failing tests**
  - Determinism: `mulberry32(hashSeed(7,'petruk',2))` gives the same first 5 values twice; `hashSeed(7,'petruk',2) !== hashSeed(7,'petruk',3)`.
  - `EASE.out(0)===0`, `EASE.out(1)===1`, `EASE.out(0.5) > 0.5`; `EASE.inOut(0.5)` is within 0.02 of 0.5; outputs are monotonic over 100 samples.
  - `TEMPERAMENTS.raksasa.arm` deep-equals `{stiffness:90, damping:9}`; `TEMPERAMENTS.halus.overshoot === 0`.
  - `depthToShadow(0)` = `{scale:1, blur:0, opacity:1}`; `depthToShadow(0.5)` = `{scale:2, blur:12, opacity:0.7}`; `depthToShadow(0.9)` equals `depthToShadow(0.6)`.
  - `lerpPose(REST_POSE, {...REST_POSE, x:1}, 0.25).x === REST_POSE.x + 0.25*(1-REST_POSE.x)`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. `cubicBezier` uses Newton–Raphson with a bisection fallback.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add deterministic rng, easing, temperament and depth math`.

### Task 4: Puppet rigs (stylized) and move templates

**Files:**
- Create: `src/rigs/types.ts`, `src/rigs/index.ts`, `src/rigs/{gunungan,semar,petruk,bagong,raksasa,eyang-putri}.ts`, `src/choreo/templates.ts`
- Test: `tests/choreo/templates.test.ts`, `tests/rigs/rigs.test.ts`

**Interfaces:**
- Consumes: `ACTIONS`, `Pose`, `EASE` names
- Produces:
  - `interface ArmRig { shoulder: [number, number]; upper: string; elbow: [number, number]; lower: string; hand: [number, number] }` (paths are SVG `d` strings in puppet-local units: height = 1, origin at the feet center, y up negative)
  - `interface Rig { key: PuppetKey; defaultType: Temperament | null; height: number; body: string; perforation: string; arms: { back: ArmRig; front: ArmRig } | null; rodAnchor: [number, number] }`, where height is in stage-y units: punakawan 0.42, halus 0.5, raksasa 0.68, gunungan 0.75
  - `getRig(key: PuppetKey): Rig`
  - `interface Phase { dur: number; ease: keyof typeof EASE; pose: Partial<Omit<Pose,'x'>>; x?: XTarget }`
  - `type XTarget = { kind: 'target'; gap: number } | { kind: 'to' } | { kind: 'from-side' } | { kind: 'off-side' } | { kind: 'rel'; dx: number }`
  - `interface Template { phases: [Phase, Phase, Phase, Phase] }` (anticipation, action, follow-through, settle)
  - `getTemplate(action: Action, style: string): Template`
  - `TARGET_REACTION: Template` (recoil applied to the struck actor)

- [ ] **Step 1: Write failing tests**
  - For every `(action, style)` in `ACTIONS`, `getTemplate` returns 4 phases with `dur > 0`.
  - Per-group total base durations (sum of phase `dur`): stage 1.2–2.0 s, gesture 0.8–1.6 s, combat 0.6–1.2 s, light 1.0–2.0 s, gunungan 2.0–3.0 s, linger = 2.7 s (1.2 hold + 1.5 fade).
  - `attack/*` templates have an action phase with `x.kind === 'target'`.
  - `getRig` returns a rig for all 6 keys. Every non-gunungan rig has `arms`; gunungan has `arms === null`. every path string matches `/^[Mm][\d\s.,\-MmLlCcQqZzHhVvAaSsTt]+$/` (Vitest runs in Node, so there is no `Path2D` here).
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the rigs as stylized wayang silhouettes: profile head, long torso, ornamented hem. Perforation is a set of small closed shapes (dots, leaf shapes) inside the body path for even-odd cutting. Semar is round-backed, Petruk tall with a long nose, Bagong round and short, the raksasa a large bulky form with a crown, Eyang Putri slender with a bun, and the gunungan a pointed leaf with tree and gate perforations.
- [ ] **Step 4:** Implement `templates.ts` as a table keyed `${action}/${style}`, with poses and angles that make each style read distinctly (spec §4/§5). `loom/*` sets depth to 0.5, `recede/*` returns depth to 0, gunungan spin animates `flipX` −1→1, and `linger/fade` holds and then goes to opacity 0.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6:** Commit `feat: add stylized puppet rigs and move templates`.

### Task 5: Choreographer core (compile and sample)

**Files:**
- Create: `src/choreo/compile.ts`, `src/choreo/cues.ts`
- Test: `tests/choreo/compile.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4
- Produces:
  - `compile(lakon: Lakon, opts?: { reducedMotion?: boolean }): Timeline` (reduced: combat amplitude ×0.5, no idle sway, `loom` keeps depth for blur but the renderer skips scale)
  - `interface Timeline { duration: number; seed: number; cast: CastMember[]; scenes: Lakon['scenes']; actors: Record<string, ActorTrack>; cues: Cue[]; captions: CaptionSpan[]; beats: Lakon['beats'] }`
  - `interface ActorTrack { rig: PuppetKey; type: Temperament; samples: Float32Array; onStage: [number, number][] }` (10 floats per sample in `Pose` key order, at 120 Hz)
  - `samplePose(tl: Timeline, id: string, t: number): Pose | null` (null when off stage; linear interpolation between samples)
  - `type Cue = { t: number; kind: 'sfx'; id: SfxBeat['sfx'] } | { t: number; kind: 'music'; pattern: MusicBeat['music'] }`
  - `interface CaptionSpan { start: number; end: number; speaker: string | null; text: string }`
  - `speakDuration(line: string): number` = `Math.max(1.5, line.length / 14)`

**Algorithm (decided here):**
- Per actor, walk its action beats. Phase base durations are scaled by `timeScale × speed (slow 1.3, normal 1, fast 0.75) × (1 + jitter×0.08×(2r−1))`. Pose deltas are scaled by `amplitude × intensity` (plus overshoot added to the action phase), and angle noise is `±5°×jitter`. `r` comes from `mulberry32(hashSeed(seed, actor, moveIndex))`.
- A beat starts from the actor's current sampled pose. If the next beat starts earlier than this one ends, this one is cut at the next beat's `t` (retarget).
- Escalation: the nth combat beat of an actor gets intensity `min(1, base × (1 + 0.15·n))`.
- `x` targets: `target` → target's x ∓ gap (facing side); `from-side` → x = −0.15 or 1.15 based on `from`; `off-side` → the nearer edge beyond the screen; `to` → `beat.to`.
- `y` is the feet line (0.86) unless the template offsets it.
- Write the result into the 120 Hz buffer. Fill gaps between beats with the held pose plus idle sway (0.4–0.8° tilt at 0.3 Hz, seeded phase). Add a speak bob (2 px ≈ 0.0037 stage-y at 4 Hz) during `speakDuration`.
- Captions: `speak` → speaker = cast name; `narrate` → speaker null; each lasts `speakDuration`.
- Cues: explicit sfx/music beats only (implicit cues come in Task 6).

- [ ] **Step 1: Write failing tests**
  - `compile` is deterministic: `JSON.stringify` of two compiles of the same fixture is equal.
  - The same style used twice by the same actor (`kick`, `laugh`, `kick`) produces different pose samples at the same relative time into each kick.
  - Changing `type` from punakawan to halus lengthens the `attack/kick` span (end − start) by ≈ 1.3/0.85.
  - Escalation: for a halus actor (low jitter) doing `attack/thrust`, `laugh`, `attack/thrust`, `laugh`, `attack/thrust` at intensity 0.6, the third attack's peak `|shoulderFront|` exceeds the first's by more than 5°.
  - `compile(fixture, { reducedMotion: true })` has no idle sway: a planted actor's tilt is constant between beats.
  - `samplePose` returns null before `enter` and after `exit`.
  - **Overlapping beat retargets without a jump:** with a beat at t = 1.0 cutting a 1.5 s beat started at 0.5, `|pose(0.999).x − pose(1.001).x| < 0.01`.
  - `speakDuration('a'.repeat(70)) === 5`, `speakDuration('hi') === 1.5`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `compile`, `samplePose` and `speakDuration` following the algorithm above.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat: compile lakon into deterministic pose timelines`.

### Task 6: Modifiers, reactions, arm springs, implicit cues

**Files:**
- Create: `src/choreo/modifiers.ts`
- Modify: `src/choreo/compile.ts`, `src/choreo/cues.ts`
- Test: `tests/choreo/modifiers.test.ts`

**Interfaces:**
- Consumes: Task 5 internals
- Produces: `applyModifiers(t: Template, mods: Modifier[], rand: () => number): Template` (may return more than 4 phases, so widen `Template.phases` to `Phase[]` with at least 4)

- [ ] **Step 1: Write failing tests**
  - `feint` adds 2 phases before the action, and the total duration grows.
  - `double` repeats the action phase, so the action phase count is 2.
  - `miss`: the action phase `x` gap grows by 0.08, and the follow-through is replaced by a stumble (tilt beyond 10°).
  - `high`: action-phase `shoulderFront` +20°, `elbowFront` +15°; `low`: −20°/−15°.
  - Reaction: the target's tilt changes during a successful `strike`, but not during `attack` with `miss`.
  - `fling` makes the target's `onStage` end within the fling span.
  - Arm spring: after a body stop, `shoulderFront` keeps moving for at least 3 samples (follow-through), and halus settles faster than punakawan.
  - Implicit cues: `enter` → `cempala-1` at its `t`; `strike` → `keprak` at the impact time; `fling` → `cempala-roll`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. The arm spring is a fixed-step (1/120 s) semi-implicit Euler pass per joint, run after the raw tracks are built: `a = k(target−x) − c·v`, with the temperament's stiffness and damping.
- [ ] **Step 4:** Run `npm test`. Expected: all PASS.
- [ ] **Step 5:** Commit `feat: add combat modifiers, reactions and arm follow-through`.

### Task 7: Clock

**Files:**
- Create: `src/clock/clock.ts`
- Test: `tests/clock/clock.test.ts`

**Interfaces:**
- Produces: `createClock(now: () => number, opts?: { maxStep?: number }): Clock`, where `Clock = { play(): void; pause(): void; seek(t: number): void; setRate(r: number): void; tick(): number; readonly playing: boolean; readonly rate: number }`. `tick()` returns the current `t` in seconds. `maxStep` defaults to 0.1 s.

- [ ] **Step 1: Write failing tests** with a fake `now`:
  - Play, advance 1000 ms, tick → 1.0. Pause, advance, tick → still 1.0.
  - `seek(30)` → 30. `setRate(0.5)`, advance 1000 ms → +0.5.
  - **Large frame gap does not advance more than maxStep:** advance 10 000 ms in one tick → `t` increases by ≤ 0.1.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add playback clock with gap protection`.

### Task 8: Renderer

**Files:**
- Create: `src/stage/layout.ts`, `src/stage/light.ts`, `src/stage/screen.ts`, `src/stage/puppet.ts`, `src/stage/render.ts`
- Test: `tests/stage/layout.test.ts`, `tests/stage/light.test.ts`

**Interfaces:**
- Consumes: `Timeline`, `samplePose`, `getRig`, `depthToShadow`
- Produces:
  - `fitStage(vw: number, vh: number): { x: number; y: number; w: number; h: number }` (16:9 letterbox)
  - `lampAt(t: number, seed: number, reduced: boolean): { intensity: number; dx: number; dy: number }`
  - `createRenderer(canvas: HTMLCanvasElement): { resize(vw: number, vh: number, dpr: number): void; draw(tl: Timeline, t: number, opts: { reducedMotion: boolean; dim: number }): void }`

- [ ] **Step 1: Write failing tests**
  - **fitStage letterboxes 16:9:** `fitStage(1000,1000)` → `{x:0, y:218.75, w:1000, h:562.5}`; `fitStage(1920,800)` → `w ≈ 1422.2, h:800`.
  - `lampAt`: over 0..60 s sampled at 240 Hz, `intensity` stays within [0.94, 1.06] and |dx|, |dy| ≤ 2. It is deterministic for the same seed. Reduced → `{intensity:1, dx:0, dy:0}`. A zero-crossing count of `intensity − mean` per second ≤ 4 (at most 2 Hz content).
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `layout.ts` and `light.ts`. Flicker is the sum of 2 seeded value-noise channels at 0.7 Hz and 1.6 Hz.
- [ ] **Step 4:** Implement `screen.ts`. The radial lamp gradient runs from Yellow core to Orange to `#0B0907`, scaled by `intensity` and `dim`. The weave texture is generated once to an offscreen canvas at ~4% alpha. Add the Teal top/bottom trim bands and the dark banana trunk band from y = 0.86.
- [ ] **Step 5:** Implement `puppet.ts`:
  - Cache each rig's body+perforation as a `Path2D`, filled `evenodd` in `#1A0F08`, so the holes let the light through.
  - Draw the arms as upper/lower paths rotated about the shoulder and elbow.
  - Draw rods at 1.5 px from the hands and `rodAnchor` down past the bottom edge.
  - Apply `depthToShadow` (scale about the lamp projection, `ctx.filter = blur(...)` only when depth > 0), `flipX` via `scale(flipX, 1)`, opacity, and the shadow offset `(−dx, −dy)`.
- [ ] **Step 6:** Implement `render.ts`: clear, draw the screen, then draw on-stage actors sorted by depth (deeper first). Scale the canvas by `dpr` in `resize`.
- [ ] **Step 7:** Run `npm test`. Expected: PASS. Then manually: a temporary `main.ts` draws the demo fixture at a fixed `t` and shows puppets on a lit screen in `npm run dev`.
- [ ] **Step 8:** Commit `feat: render shadow stage with lamp, depth and perforated puppets`.

### Task 9: Sound

**Files:**
- Create: `src/audio/scheduler.ts`, `src/audio/instruments.ts`, `src/audio/patterns.ts`, `src/audio/engine.ts`
- Test: `tests/audio/scheduler.test.ts`, `tests/audio/patterns.test.ts`

**Interfaces:**
- Consumes: `Cue`, `Clock`
- Produces:
  - `cuesInWindow(cues: Cue[], from: number, to: number): Cue[]` (half-open `[from, to)`, sorted)
  - `SLENDRO_HZ: readonly number[]` (5 tones per octave, 2 octaves from 220 Hz, steps of 2^(240/1200))
  - `patternNotes(p: 'calm'|'war'|'playful', from: number, to: number): { t: number; degree: number; gong: boolean }[]`, where calm = 1 note/s, war = 4/s, playful = 2.5/s syncopated, with a gong every 8 s (calm) or 4 s (war)
  - `createAudio(): { unlock(): Promise<void>; sync(cues: Cue[], t: number, playing: boolean): void; seek(t: number): void; setMuted(m: boolean): void }`, using a 0.2 s lookahead every animation frame

- [ ] **Step 1: Write failing tests**
  - `cuesInWindow` boundaries: a cue at `from` is included and a cue at `to` excluded.
  - **Seek cancels and reschedules only future cues:** a pure `planSchedule(cues, scheduledUntil, t, lookahead)` helper (export it) returns nothing before `t` after a backward seek resets `scheduledUntil = t`.
  - `SLENDRO_HZ[0] === 220`, `SLENDRO_HZ[5]` ≈ 440 (±0.5).
  - `patternNotes('war', 0, 1).length === 4`; gong at t = 0 for war and calm.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the pure helpers.
- [ ] **Step 4:** Implement `instruments.ts` per spec §7:
  - cempala: noise → band-pass 1 kHz, 60 ms decay, plus a 180 Hz sine thump
  - keprak: 3–6 kHz partials, 150 ms
  - gong: ~50 Hz plus a detuned partner with a long decay
  - metallophone: inharmonic partials ×1, ×2.76, ×5.4 with a fast attack
  - Master gain; mute ramps over 150 ms.
- [ ] **Step 5:** Implement `engine.ts`. On `seek`, stop every live node, reset `scheduledUntil`, and reschedule the current music pattern from `t`.
- [ ] **Step 6:** Run `npm test`. Expected: PASS. Manual: knocks land on the strikes when watching the demo.
- [ ] **Step 7:** Commit `feat: synthesize cempala, keprak and slendro gamelan on the timeline clock`.

### Task 10: Shell, lamp intro and captions

**Files:**
- Create: `src/ui/tokens.css`, `src/ui/lamp-intro.ts`, `src/ui/captions.ts`, `src/app.ts`
- Modify: `src/main.ts`, `index.html`
- Test: `tests/ui/captions.test.ts`

**Interfaces:**
- Consumes: `validateLakon`, `compile`, `createClock`, `createRenderer`, `createAudio`
- Produces:
  - `parseCaption(text: string): ({ text: string } | { term: string; meaning: string })[]` (syntax `[[term|meaning]]`)
  - `loadLakon(name: string): Promise<{ ok: true; tl: Timeline } | { ok: false; errors: ValidationError[] | string }>`, which fetches `/lakon/${name}.json`; name is from `?lakon=`, default `demo-eyang-putri`, allowed chars `[a-z0-9-]`
  - `startApp(root: HTMLElement): void`
  - URL params: `?t=<seconds>&paused=1` render that frame paused (used by Playwright)

- [ ] **Step 1: Write failing tests**: `parseCaption('a [[sembah|a bow]] b')` deep-equals `[{text:'a '},{term:'sembah',meaning:'a bow'},{text:' b'}]`; an unclosed `[[x` is kept as plain text.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `parseCaption` and `loadLakon`.
- [ ] **Step 4:** Implement `tokens.css` with the brand variables, fonts (`@fontsource` imports), page background, and the reduced-motion and hover-gating media queries.
- [ ] **Step 5:** Implement the lamp intro: a dark stage with a small Yellow flame (CSS) and the copy `Nyalakan blencong` / `Light the lamp`. On click: `audio.unlock()`, then the lamp intensity ramps 0→1 over 1.2 s with ease-out (a renderer `dim` param, not CSS), then play. Captions sit bottom-center:
  - narration in Cormorant Garamond italic
  - speaker in Yellow small caps
  - terms with a dotted Purple underline and the meaning in a tooltip (hover or tap, 150 ms ease-out from scale 0.97 + opacity 0)
  - maximum 2 lines, crossfading 200 ms between spans
- [ ] **Step 6:** Implement the `app.ts` frame loop: `t = clock.tick(); renderer.draw(tl, t, …); audio.sync(tl.cues, t, clock.playing); captions.update(t)`.
- [ ] **Step 7:** Run `npm test`. Expected: PASS. Manual in `npm run dev`: click the lamp, the demo plays with captions and sound.
- [ ] **Step 8:** Commit `feat: add lamp intro, captions and app frame loop`.

### Task 11: Controls, scrubber, end card, dev panel, responsive

**Files:**
- Create: `src/ui/controls.ts`, `src/ui/scrubber.ts`, `src/ui/end-card.ts`, `src/ui/debug-panel.ts`, `src/ui/gunungan-ink.svg`
- Modify: `src/app.ts`, `src/ui/tokens.css`
- Test: `tests/visual/app.spec.ts` (Playwright)

**Interfaces:**
- Consumes: `Clock`, `Timeline.scenes`, `ValidationError[]`

- [ ] **Step 1:** Add Playwright (`npx playwright install chromium`) and a `test:visual` script that runs against `vite preview`.
- [ ] **Step 2: Write failing Playwright tests**
  - Scene markers render with the 5 demo scene titles. Clicking "Gara-gara" seeks to its `start`.
  - Controls are hidden after 2.5 s without pointer movement and visible after `mouse.move`.
  - Pressing `D` toggles the dev panel. The panel highlights the current beat.
  - **Bad script shows message and errors:** with `?lakon=does-not-exist`, the stage shows "The dalang can't find this play." and the dev panel opens with the error. An invalid fixture `tests/fixtures/broken.json`, copied to `public/lakon/broken.json` in test setup, lists its validation errors.
  - At a 390×844 viewport, the rotate hint is visible.
  - The end card appears after `duration` with "Bayang Eyang", "Watch again" and "@derbyps.dev".
- [ ] **Step 3:** Run `npm run test:visual`. Expected: FAIL.
- [ ] **Step 4:** Implement the controls bar:
  - Play/pause (Purple), captions and sound toggles (Orange on hover), Teal border, faint Teal background
  - Fades with opacity/translateY over 200 ms ease-out
  - The scrubber has an Orange progress fill and scene markers, with the active marker Purple
  - Keyboard: Space toggles play, ←/→ seek ±5 s; no animation on keyboard actions
- [ ] **Step 5:** Implement the end card: an ink line-art gunungan SVG with the 4 accents as small highlights, "Bayang Eyang", and *Watch again* (restarts from 0 with the lamp still lit). It fades in 400 ms after the linger completes.
- [ ] **Step 6:** Implement the dev panel (Teal borders, monospace): beats list, current `t`, FPS, validation status, and a lakon switcher (`demo-eyang-putri` / `showcase`).
- [ ] **Step 7:** Read `prefers-reduced-motion` once at startup and pass it to both `compile(…, { reducedMotion })` and `draw` opts (no flicker, no loom scale). Add the portrait rotate hint.
- [ ] **Step 8:** Run `npm run test:visual` and `npm test`. Expected: PASS.
- [ ] **Step 9:** Commit `feat: add controls, scene scrubber, end card and dev panel`.

### Task 12: Story demo script

**Files:**
- Create: `public/lakon/demo-eyang-putri.json`, `tests/script/coverage.ts` (helper)
- Test: `tests/script/demo.test.ts`

**Interfaces:**
- Produces: `coverage(lakon: Lakon): { actions: Set<Action>; styles: Set<string>; mods: Set<Modifier> }`, where `styles` holds `do/style` keys with defaults resolved

- [ ] **Step 1: Write failing tests**: the demo validates (`ok === true`); `coverage().actions.size === 22`; scenes are exactly `gunungan, jejer, perang, gara-gara, tancep-kayon` in that order; `compile(...).duration` is between 55 and 75.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Write the demo per spec §8:
  - The fictional Eyang Putri leaves her village in 1965 with a rice tin.
  - Narration is in English with `[[term|meaning]]` for sembah, kelir, blencong, gara-gara, punakawan and tancep kayon.
  - Petruk's rice-tin joke is a `speak` line.
  - Music: calm → war → playful → calm. Gong at the start and the end.
- [ ] **Step 4:** Run the tests. Expected: PASS. Manual: watch it end to end in the browser.
- [ ] **Step 5:** Commit `feat: add Eyang Putri story demo`.

### Task 13: Showcase script

**Files:**
- Create: `public/lakon/showcase.json`
- Test: `tests/script/showcase.test.ts`

- [ ] **Step 1: Write failing tests**:
  - It validates. `coverage().styles.size === 51` and `coverage().mods.size === 5`.
  - The cast contains 4 members with `puppet: 'petruk'` and types halus, gagah, raksasa and punakawan, each with an `attack/sweep` beat.
  - Petruk performs `attack/kick` twice with a different beat in between.
  - `duration ≤ 240`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Write the script per spec §8b. Each move has a `narrate` label in the form `attack · slam + feint`.
- [ ] **Step 4:** Run the tests. Expected: PASS. Manual: watch at 0.5× and note any template that reads poorly, then fix it in `templates.ts`.
- [ ] **Step 5:** Commit `feat: add sabetan gallery showcase of every move`.

### Task 14: Traced puppet art pass (time-boxed 1 h)

**Files:**
- Modify: `src/rigs/{gunungan,semar,petruk,raksasa}.ts`
- Create: `README.md` (credits section)

- [ ] **Step 1:** Search Wikimedia Commons for public-domain or CC0/CC-BY wayang kulit images of the gunungan, Semar, Petruk and a raksasa. Record each URL, author and license.
- [ ] **Step 2:** For each usable image: isolate the silhouette, vectorize it (potrace), normalize it to rig units, split the arms at the shoulder and elbow, and keep the existing joint and anchor coordinates.
- [ ] **Step 3:** Run `npm test` (rig tests). Expected: PASS. Check the showcase visually.
- [ ] **Step 4:** Write `README.md`: what it is, how to run it (`npm i`, `npm run dev`, `?lakon=showcase`), tests, and credits and licenses for every traced source. If the time box expires, keep the stylized rigs and note that in the README.
- [ ] **Step 5:** Commit `feat: trace authentic puppet silhouettes with credits`.

### Task 15: Visual baselines, performance and feel tuning

**Files:**
- Modify: `tests/visual/app.spec.ts`, `src/choreo/temperament.ts` (tuned values only)
- Create: `tests/visual/frames.spec.ts`

- [ ] **Step 1:** Write `frames.spec.ts`: screenshots via `?t=…&paused=1` for the lamp intro, the gunungan mid-spin (t ≈ 2.5), the giant looming (t ≈ 24.5), the gara-gara miss, and the linger (duration − 1). Use `toHaveScreenshot` with `maxDiffPixelRatio: 0.01`.
- [ ] **Step 2:** Generate the baselines (`npx playwright test --update-snapshots`), review each image by eye, and commit the approved ones.
- [ ] **Step 3:** Performance: in Chrome DevTools, record the perang at 1× and confirm no long frames (> 20 ms). If there are any, cache the blurred puppet bitmap per depth step (0.05).
- [ ] **Step 4:** Feel tuning:
  - Watch the demo and the showcase at 0.5× and frame by frame, and adjust only the `TEMPERAMENTS` values and template `dur`s.
  - Rerun `npm test`, since the template duration-range tests guard against drift.
  - Check on a real phone in landscape.
- [ ] **Step 5:** Add `public/sw.js`, a cache-first service worker that caches same-origin GET responses on fetch, and register it in `main.ts` for production builds only. Run `npm run build && npm run preview`, load once, go offline in DevTools, reload, and confirm the demo plays (fonts are self-hosted).
- [ ] **Step 6:** Commit `test: add frame baselines and tune motion feel`.
