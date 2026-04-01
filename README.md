# Buddy Hunter

[中文文档](README.zh-CN.md)

A Claude Code plugin that helps you get your dream `/buddy` companion.

## What is this?

Claude Code's `/buddy` command generates a companion creature deterministically from your user ID. The species, rarity, stats, and appearance are all fixed per account — you can't reroll by just running `/buddy` again.

This plugin reverses the PRNG algorithm and brute-forces a seed that produces your desired companion. Want a **Legendary Shiny Axolotl** with maxed-out WISDOM? We got you.

## Install

### Quick Install

Run in your terminal:

```bash
claude plugin marketplace add ming-claude-skills/buddy-hunter
claude plugin install buddy-hunter@buddy-hunter
```

### Manual Install (in Claude Code)

Run the following commands **one at a time** in Claude Code:

```
/plugin marketplace add ming-claude-skills/buddy-hunter
/plugin install buddy-hunter@buddy-hunter
/reload-plugins
```

## Usage

Invoke the skill directly:

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

## ⚠️ Risk Disclaimer

**This plugin modifies Claude Code's local configuration or binary. Use at your own risk.**

### General Risks (Both Paths)

- **Config corruption**: Editing `~/.claude.json` with malformed JSON will prevent Claude Code from starting. The skill validates JSON after every edit, but mistakes can happen. **Always keep a backup.**
- **Terms of Service**: Modifying Claude Code's behavior may violate [Anthropic's Terms of Service](https://www.anthropic.com/terms). No account bans have been observed for cosmetic-only changes, but **there is no guarantee**. This project is not affiliated with or endorsed by Anthropic.
- **SALT changes**: The SALT value (`friend-2026-401`) may change with Claude Code updates. If it does, your buddy will revert and scripts need updating.

### OAuth Path (Binary Patching) — Additional Risks

- **Binary breakage**: Patching the binary incorrectly could crash Claude Code. **Always back up the binary first** — the skill does this automatically.
- **Code signing invalidation**: macOS Hardened Runtime signature is broken after patching. This may cause Keychain access issues (OAuth token retrieval). Ad-hoc re-signing usually fixes this, but is not guaranteed.
- **Auto-update overwrites**: Every Claude Code update replaces the binary, undoing your patch. You'll need to re-run the skill after each update.
- **Unintended replacements**: `sed` replaces ALL occurrences of the SALT string in the binary. In the unlikely event the same string appears elsewhere, it could cause unexpected behavior. (Analysis of the source code shows the SALT is only used in the buddy system, but future versions could differ.)

### How to Recover

| Situation | Recovery |
|-----------|----------|
| Broken `~/.claude.json` | `cp ~/.claude.json.bak ~/.claude.json` |
| Broken Claude Code binary | `cp /path/to/claude.bak /path/to/claude` |
| Want to undo everything | Restore both backups, or reinstall Claude Code |

## License

MIT
