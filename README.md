# Buddy Hunter

A Claude Code plugin that helps you get your dream `/buddy` companion.

## What is this?

Claude Code's `/buddy` command generates a companion creature deterministically from your user ID. The species, rarity, stats, and appearance are all fixed per account — you can't reroll by just running `/buddy` again.

This plugin reverses the PRNG algorithm and brute-forces a seed that produces your desired companion. Want a **Legendary Shiny Axolotl** with maxed-out WISDOM? We got you.

## Install

```bash
claude plugin add ming-claude-skills/buddy-hunter
```

## Usage

Just ask Claude Code:

```
/buddy-hunter
```

Or describe what you want in natural language:

- "I want a legendary shiny dragon buddy"
- "Help me get the rarest buddy possible"
- "换一个 legendary axolotl buddy"
- "我想要一个闪光传说水龙"

Claude will:
1. Check your login type (OAuth vs API key)
2. Run the appropriate brute-force search
3. Guide you through the config change
4. You restart Claude Code, run `/buddy`, and enjoy!

## How it works

### The Algorithm

```
userId + SALT → Bun.hash() → mulberry32 PRNG → rarity → species → eye → hat → shiny → stats
```

Everything is deterministic. Same input = same buddy, every time.

### Two Paths

| Login Type | Method | Risk |
|-----------|--------|------|
| **API Key / No OAuth** | Change `userID` in `~/.claude.json` | None |
| **OAuth** | Replace SALT in binary (same-length patch) | Very low (cosmetic-only change, no telemetry of binary hash) |

### Available Species (18)

duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk

### Rarity Tiers

| Rarity | Weight | Probability |
|--------|--------|-------------|
| Common | 60 | 60% |
| Uncommon | 25 | 25% |
| Rare | 10 | 10% |
| Epic | 4 | 4% |
| Legendary | 1 | 1% |

Shiny chance: 1%. Legendary + Shiny = ~0.01%.

### Stats

5 stats: DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK

- Legendary floor: 50 (common: 5)
- One peak stat (up to 100), one dump stat (40-54 for legendary), rest 50-89
- **Theoretical max total: 421**

## Requirements

- [Bun](https://bun.sh/) runtime (the search script MUST run under Bun, not Node.js — Claude Code uses `Bun.hash()` which produces different results than Node's FNV-1a fallback)

## Important Notes

- The SALT value (`friend-2026-401`) may change with Claude Code updates. The skill includes instructions to extract it from the binary.
- For OAuth users: binary patches are overwritten by auto-updates — you'll need to re-patch after each update.
- This plugin only affects the cosmetic `/buddy` companion. It does not modify any functional behavior, API calls, or billing.

## License

MIT
