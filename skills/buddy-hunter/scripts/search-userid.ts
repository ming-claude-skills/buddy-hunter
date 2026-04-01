#!/usr/bin/env bun
// Search for a userID that produces the desired buddy companion.
// Usage: bun search-userid.ts [options]
//   --species <name>     Target species (default: any)
//   --rarity <name>      Target rarity (default: any)
//   --shiny              Require shiny (default: false)
//   --stat <name>        Require this stat = 100 (default: none)
//   --min-total <n>      Minimum stat total (default: 0)
//   --salt <value>       Override SALT (default: friend-2026-401)
//   --limit <n>          Max candidates per prefix (default: 200000000)

const SPECIES = ['duck','goose','blob','cat','dragon','octopus','owl','penguin','turtle','snail','ghost','axolotl','capybara','cactus','robot','rabbit','mushroom','chonk'] as const
const RARITIES = ['common','uncommon','rare','epic','legendary'] as const
const RARITY_WEIGHTS: Record<string, number> = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 }
const EYES = ['·','✦','×','◉','@','°'] as const
const HATS = ['none','crown','tophat','propeller','halo','wizard','beanie','tinyduck'] as const
const STAT_NAMES = ['DEBUGGING','PATIENCE','CHAOS','WISDOM','SNARK'] as const
const RARITY_FLOOR: Record<string, number> = { common: 5, uncommon: 15, rare: 25, epic: 35, legendary: 50 }

function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(s: string) {
  return Number(BigInt(Bun.hash(s)) & 0xffffffffn)
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!
}

function rollRarity(rng: () => number) {
  let roll = rng() * 100
  for (const r of RARITIES) { roll -= RARITY_WEIGHTS[r]; if (roll < 0) return r }
  return 'common'
}

function rollFull(uid: string, salt: string) {
  const rng = mulberry32(hashString(uid + salt))
  const rarity = rollRarity(rng)
  const species = pick(rng, SPECIES)
  const eye = pick(rng, EYES)
  const hat = rarity === 'common' ? 'none' : pick(rng, HATS)
  const shiny = rng() < 0.01
  const floor = RARITY_FLOOR[rarity]
  const peak = pick(rng, STAT_NAMES)
  let dump = pick(rng, STAT_NAMES); while (dump === peak) dump = pick(rng, STAT_NAMES)
  const stats: Record<string, number> = {}
  for (const n of STAT_NAMES) {
    if (n === peak) stats[n] = Math.min(100, floor + 50 + Math.floor(rng() * 30))
    else if (n === dump) stats[n] = Math.max(1, floor - 10 + Math.floor(rng() * 15))
    else stats[n] = floor + Math.floor(rng() * 40)
  }
  const total = Object.values(stats).reduce((a, b) => a + b, 0)
  return { uid, rarity, species, eye, hat, shiny, peak, dump, stats, total }
}

// --- Parse args ---
const args = Bun.argv.slice(2)
function getArg(name: string): string | undefined {
  const idx = args.indexOf('--' + name)
  return idx >= 0 ? args[idx + 1] : undefined
}
const hasFlag = (name: string) => args.includes('--' + name)

const TARGET_SPECIES = getArg('species') || null
const TARGET_RARITY = getArg('rarity') || null
const WANT_SHINY = hasFlag('shiny')
const WANT_STAT = getArg('stat') || null
const MIN_TOTAL = parseInt(getArg('min-total') || '0')
const SALT = getArg('salt') || 'friend-2026-401'
const LIMIT = parseInt(getArg('limit') || '200000000')

if (TARGET_SPECIES && !SPECIES.includes(TARGET_SPECIES as any)) {
  console.error(`Unknown species: ${TARGET_SPECIES}\nAvailable: ${SPECIES.join(', ')}`)
  process.exit(1)
}

console.log(`Searching: species=${TARGET_SPECIES||'any'} rarity=${TARGET_RARITY||'any'} shiny=${WANT_SHINY} stat=${WANT_STAT||'any'}=100 min-total=${MIN_TOTAL} salt=${SALT}`)

let best: ReturnType<typeof rollFull> | null = null
const PREFIXES = ['buddy-pick-', 'bp-', 'b-', 'ax-', 'w-', 'cc-', 'u-', 'x-']

for (const prefix of PREFIXES) {
  for (let i = 0; i < LIMIT; i++) {
    const r = rollFull(prefix + i, SALT)
    if (TARGET_SPECIES && r.species !== TARGET_SPECIES) continue
    if (TARGET_RARITY && r.rarity !== TARGET_RARITY) continue
    if (WANT_SHINY && !r.shiny) continue
    if (WANT_STAT && r.stats[WANT_STAT] !== 100) continue
    if (r.total < MIN_TOTAL) continue
    if (!best || r.total > best.total) {
      best = r
      console.log(`Found: total=${best.total} uid="${best.uid}" ${best.rarity}${best.shiny?' shiny':''} ${best.species} eye:${best.eye} hat:${best.hat}`)
      if (best.total >= 418) break
    }
  }
  if (best && best.total >= 418) break
}

if (best) {
  console.log('\n=== BEST RESULT ===')
  console.log(`userID: "${best.uid}"`)
  console.log(`${best.rarity}${best.shiny ? ' shiny' : ''} ${best.species}  eye:${best.eye}  hat:${best.hat}`)
  console.log(`total: ${best.total}/421  peak:${best.peak}  dump:${best.dump}`)
  for (const n of STAT_NAMES) console.log(`  ${n.padEnd(10)} ${best.stats[n]}`)
} else {
  console.log('\nNo match found. Try relaxing filters or increasing --limit.')
}
