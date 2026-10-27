# Bayang Eyang

*Bayang Eyang* ("grandparent's shadow") turns a story about someone you love into a live **wayang kulit** shadow play. An open-weight model acts as the **dalang** (puppet master) and writes the play as a structured script. The browser performs that script live, with lamp-lit shadows, jointed puppets on rods, wooden knocks and gamelan.

This repository currently holds **the stage**: the script format, its validator, the choreographer and the renderer. The dalang (the AI writer) is the next sub-project.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
```

- `/`: the Eyang Putri story demo (about a minute)
- `/?lakon=showcase`: the *sabetan gallery*, every move in the vocabulary (51 styles, 5 modifiers)
- `/?t=24.6&paused=1`: freeze any moment
- Press **D** for the dalang's notes: the script, the current beat and the validation status
- Space plays and pauses, and ← / → skip 5 s

## Test it

```bash
npm test               # unit tests (Vitest)
npm run test:visual    # browser tests (Playwright)
npm run build          # type-check and production build
```

## How it works

```
lakon.json → validate → compile (120 Hz pose buffers) → render frame(t) + schedule sound(t)
```

- **`src/script`**: the closed vocabulary (22 actions, 51 styles, 5 modifiers), the Zod schema, and nine validation rules. The rules produce plain-English errors, which are later fed back to the dalang.
- **`src/choreo`**: move templates (anticipation → action → follow-through → settle), four temperaments (halus, gagah, raksasa, punakawan), seeded variation, escalation, modifiers, hit reactions and spring-driven arms. Playback is deterministic: the same script and time always produce the same frame.
- **`src/stage`**: Canvas 2D. Lamp flicker (under 2 Hz, ±6%), depth (the shadow swells and blurs near the lamp), perforated silhouettes cut with even-odd fill, and rods.
- **`src/audio`**: everything is synthesized with Web Audio: the cempala knock, the keprak plates, the gong and a slendro metallophone.

The full design is in [`docs/superpowers/specs`](docs/superpowers/specs), and the build plan is in [`docs/superpowers/plans`](docs/superpowers/plans).

## Credits

- **Puppet silhouettes**: drawn for this project in code (`src/rigs`), after the conventions of Javanese wayang kulit: Semar, Petruk and Bagong of the punakawan, a raksasa, a putri figure and the gunungan. No museum images were traced.
- **Fonts**: [Cormorant Garamond](https://github.com/CatharsisFonts/Cormorant) and [Instrument Sans](https://github.com/Instrument/instrument-sans), both under the SIL Open Font License, self-hosted through Fontsource.
- **Sound**: synthesized live, with no samples.
- The story in the demo is fictional.
