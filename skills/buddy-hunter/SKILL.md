---
name: buddy-hunter
description: "Help users get their desired Claude Code /buddy companion by brute-forcing the deterministic PRNG seed. Triggers when users mention /buddy, companion, buddy hunting, buddy species, buddy rarity, want a specific buddy, want to change their buddy, reroll buddy, legendary buddy, shiny buddy, or any discussion about customizing Claude Code's companion creature. Also triggers on: 'how do I get a different buddy', 'I want a dragon/axolotl/cat buddy', 'can I change my companion', 'buddy 怎么换', '换 buddy', '想要传说', '想要闪光'."
---

# Buddy Hunter — Claude Code Companion 定制指南

你是帮助用户获取指定 `/buddy` companion 的专家。根据用户的登录状态（OAuth vs 非 OAuth），采用不同的技术路径。

## 核心原理

`/buddy` 的 companion 外观属性（species, rarity, eye, hat, shiny, stats）统称为 **Bones**，每次启动时从 `userId` **确定性重新计算**，不存储在配置文件中。用户无法通过编辑 config 中的 companion 字段来伪造属性——bones 每次都会被覆盖。

### 算法链路

```
companionUserId() → oauthAccount.accountUuid ?? userID ?? 'anon'
      ↓
key = userId + SALT        // SALT = 'friend-2026-401'
      ↓
hashString(key)            // Bun 环境: Bun.hash() (wyhash); Node.js: FNV-1a
      ↓
mulberry32(seed)           // Mulberry32 确定性 PRNG
      ↓
依次消费随机数：rarity → species → eye → hat → shiny → stats
```

### 关键陷阱：哈希函数分叉

```typescript
function hashString(s: string): number {
  if (typeof Bun !== 'undefined') {
    return Number(BigInt(Bun.hash(s)) & 0xffffffffn)  // wyhash
  }
  // FNV-1a fallback（Node.js 环境）
}
```

**Claude Code 是 Bun 编译的二进制文件**。暴力搜索脚本**必须用 `bun` 运行**，用 Node.js 会得到完全错误的结果。这是最容易踩的坑。

### 数据表

**18 种物种**：duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk

**稀有度权重**：common(60), uncommon(25), rare(10), epic(4), legendary(1)

**Stats 生成**：
- floor 由 rarity 决定：common=5, uncommon=15, rare=25, epic=35, legendary=50
- 随机选 peak 属性：`min(100, floor + 50 + rand(0~29))`
- 随机选 dump 属性（≠ peak）：`max(1, floor - 10 + rand(0~14))`
- 其余属性：`floor + rand(0~39)`
- Legendary 理论总和上限：100 + 54 + 89×3 = **421**

**Shiny**：`rng() < 0.01`（1% 概率）

**配置文件路径**：`~/.claude.json`（注意不是 `~/.claude/config.json`）

---

## 第一步：判断用户登录状态

读取 `~/.claude.json`，检查：
- `oauthAccount.accountUuid` 是否存在 → OAuth 登录
- 只有 `userID` → 非 OAuth 登录

```bash
python3 -c "
import json
with open('$HOME/.claude.json') as f:
    c = json.load(f)
print('oauthAccount.accountUuid:', c.get('oauthAccount', {}).get('accountUuid', 'NOT SET'))
print('userID:', c.get('userID', 'NOT SET'))
print('companion:', json.dumps(c.get('companion'), indent=2, ensure_ascii=False))
"
```

然后根据结果走对应路径。

---

## 路径 A：非 OAuth 登录（改 userID）

这是最简单的路径。`companionUserId()` 会 fallback 到 `config.userID`，而这个字段可以自由修改。

### 步骤

1. **确认 bun 已安装**：`bun --version`。未安装则 `curl -fsSL https://bun.sh/install | bash`
2. **根据用户需求生成暴力搜索脚本**（见下方模板），用 `bun` 执行
3. **编辑 `~/.claude.json`**：将 `"userID"` 改为搜索到的值
4. **删除 `"companion"` 字段**（强制重新 hatch）
5. **重启 Claude Code**，执行 `/buddy`

### 风险：无

改 userID 不影响任何功能。

---

## 路径 B：OAuth 登录（二进制 SALT 替换）

OAuth 登录时 `accountUuid` 优先且不可修改——它来自服务端，写在 OAuth token 里，且有自愈机制（token 刷新时会从服务端拉取真实值覆盖回来）。

直接改 `accountUuid` 的后果：
- API 鉴权失败（`claude.ts` 将其发送给服务端）
- OAuth profile 查询 404（`getOauthProfile.ts` 用它当参数）
- 被自动覆盖还原（OAuth 刷新流程写回真实值）

因此需要改另一个变量：**SALT**。通过在二进制中替换等长的 SALT 字符串，使用户的真实 `accountUuid` + 新 SALT 产出目标 buddy。

### 步骤

1. **确认 bun 已安装**
2. **获取用户的真实 accountUuid**：从 `~/.claude.json` 的 `oauthAccount.accountUuid` 读取
3. **搜索等长替换 SALT**（见下方模板 B），用 `bun` 执行
4. **定位 Claude Code 二进制路径**：

```bash
# 获取实际二进制路径（跟随符号链接）
readlink -f $(which claude) 2>/dev/null || readlink $(which claude)
# 或直接查看版本目录
ls ~/.local/share/claude/versions/
```

5. **备份二进制**：

```bash
CLAUDE_BIN=$(readlink -f $(which claude) 2>/dev/null || readlink $(which claude))
cp "$CLAUDE_BIN" "${CLAUDE_BIN}.bak"
```

6. **替换 SALT**（等长替换，不破坏二进制结构）：

```bash
sed -i '' "s/friend-2026-401/NEW_SALT_HERE_/g" "$CLAUDE_BIN"
```

7. **可选：重新 ad-hoc 签名**（修改后 macOS 代码签名失效）：

```bash
codesign --remove-signature "$CLAUDE_BIN"
codesign -s - "$CLAUDE_BIN"
```

8. **删除 `~/.claude.json` 中的 `"companion"` 字段**
9. **重启 Claude Code**，执行 `/buddy`

### 安全性分析

**封号风险：极低**
- 没有运行时自校验（二进制不检查自身哈希）
- 没有上报二进制指纹的遥测事件
- User-Agent 只报版本号，不含二进制哈希
- SALT 仅用于 buddy 系统，不影响 API 鉴权、计费、遥测
- 等长替换不改变文件大小，不破坏偏移量

**实际风险**：
- macOS 代码签名失效 → hardened runtime 可能影响 Keychain 访问（ad-hoc 重签可解决）
- 自动更新会覆盖补丁 → 每次更新后需重新 patch
- SALT 值可能随版本更新变化 → 需从新版二进制提取：`strings $(which claude) | grep 'friend-'`

---

## 暴力搜索脚本模板

### 模板 A：搜索 userID（非 OAuth）

根据用户需求修改过滤条件后生成并用 `bun` 执行：

```typescript
#!/usr/bin/env bun
const SALT = 'friend-2026-401'
const SPECIES = ['duck','goose','blob','cat','dragon','octopus','owl','penguin','turtle','snail','ghost','axolotl','capybara','cactus','robot','rabbit','mushroom','chonk']
const RARITIES = ['common','uncommon','rare','epic','legendary'] as const
const RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 }
const EYES = ['·','✦','×','◉','@','°']
const HATS = ['none','crown','tophat','propeller','halo','wizard','beanie','tinyduck']
const STAT_NAMES = ['DEBUGGING','PATIENCE','CHAOS','WISDOM','SNARK']
const RARITY_FLOOR = { common: 5, uncommon: 15, rare: 25, epic: 35, legendary: 50 }

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

function rollFull(uid: string) {
  const rng = mulberry32(hashString(uid + SALT))
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

// ===== 根据用户需求修改过滤条件 =====
const TARGET_SPECIES = 'axolotl'    // 目标物种（null 则不限）
const TARGET_RARITY = 'legendary'   // 目标稀有度（null 则不限）
const WANT_SHINY = true             // 是否要求 shiny
const WANT_STAT: string | null = 'WISDOM'  // 要求某属性 = 100（null 则不限）
// ====================================

let best: ReturnType<typeof rollFull> | null = null
const PREFIXES = ['buddy-pick-', 'bp-', 'b-', 'ax-', 'w-', 'cc-', 'u-', 'x-']

for (const prefix of PREFIXES) {
  for (let i = 0; i < 200_000_000; i++) {
    const r = rollFull(prefix + i)
    if (TARGET_SPECIES && r.species !== TARGET_SPECIES) continue
    if (TARGET_RARITY && r.rarity !== TARGET_RARITY) continue
    if (WANT_SHINY && !r.shiny) continue
    if (WANT_STAT && r.stats[WANT_STAT] !== 100) continue
    if (!best || r.total > best.total) {
      best = r
      if (best.total >= 418) break
    }
  }
  console.log(`Done "${prefix}" → best: ${best ? best.total + ' ' + best.uid : 'none'}`)
  if (best && best.total >= 418) break
}

if (best) {
  console.log('\n=== BEST ===')
  console.log(`userID: "${best.uid}"`)
  console.log(`${best.rarity} ${best.shiny ? 'shiny ' : ''}${best.species}  eye:${best.eye} hat:${best.hat}`)
  console.log(`total: ${best.total}/421  peak:${best.peak} dump:${best.dump}`)
  for (const n of STAT_NAMES) console.log(`  ${n.padEnd(10)} ${best.stats[n]}`)
}
```

### 模板 B：搜索等长 SALT（OAuth 用户）

将脚本中的 `UID` 替换为用户的真实 `accountUuid`，完整复制模板 A 中的算法函数定义后，将搜索主逻辑替换为：

```typescript
#!/usr/bin/env bun
// ===== 算法函数（与模板 A 完全相同）=====
// 复制模板 A 中从 SALT 到 rollFull 的所有常量和函数定义
// ... mulberry32, hashString, pick, rollRarity ...

const UID = 'USER_ACCOUNT_UUID_HERE'  // ← 替换为用户的 oauthAccount.accountUuid
const ORIG_SALT = 'friend-2026-401'
const ORIG_SALT_LEN = ORIG_SALT.length  // 15

// ===== 过滤条件 =====
const TARGET_SPECIES = 'axolotl'
const TARGET_RARITY = 'legendary'
const WANT_SHINY = true
const WANT_STAT: string | null = 'WISDOM'
// ====================

function rollWithSalt(salt: string) {
  const rng = mulberry32(hashString(UID + salt))
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
  return { salt, rarity, species, eye, hat, shiny, peak, dump, stats, total }
}

let best: ReturnType<typeof rollWithSalt> | null = null
// 7字符前缀 + 8字符数字 = 15字符（等长）
const PREFIXES = ['friend-','fbuddy-','animal-','legend-','wisdom-','axolot-','shinny-','golden-','cosmic-','mystic-','dragon-','sacred-','divine-','arcane-','pheonx-','zodiac-']

for (const prefix of PREFIXES) {
  for (let i = 0; i < 100_000_000; i++) {
    const salt = prefix + String(i).padStart(8, '0')
    const r = rollWithSalt(salt)
    if (TARGET_SPECIES && r.species !== TARGET_SPECIES) continue
    if (TARGET_RARITY && r.rarity !== TARGET_RARITY) continue
    if (WANT_SHINY && !r.shiny) continue
    if (WANT_STAT && r.stats[WANT_STAT] !== 100) continue
    if (!best || r.total > best.total) {
      best = r
      console.log(`Found: ${best.total} ${best.salt} ${JSON.stringify(best.stats)}`)
    }
    if (best && best.total >= 418) break
  }
  console.log(`Done prefix "${prefix}"`)
  if (best && best.total >= 418) break
}

if (best) {
  console.log(`\n=== BEST SALT (${best.salt.length} chars, original: ${ORIG_SALT_LEN} chars) ===`)
  console.log(`Replace: "${ORIG_SALT}" → "${best.salt}"`)
  console.log(`Length match: ${best.salt.length === ORIG_SALT_LEN}`)
  console.log(`${best.rarity} ${best.shiny ? 'shiny ' : ''}${best.species}  eye:${best.eye} hat:${best.hat}`)
  console.log(`total: ${best.total}/421  peak:${best.peak} dump:${best.dump}`)
  for (const n of STAT_NAMES) console.log(`  ${n.padEnd(10)} ${best.stats[n]}`)
}
```

---

## 搜索策略速查

| 需求 | 搜索量级 | 耗时 |
|------|---------|------|
| 指定物种 | ~100 | 秒出 |
| 指定物种 + legendary | ~10K | 秒出 |
| 指定物种 + legendary + shiny | ~1M | 几秒 |
| 上述 + 指定属性 = 100 | ~10M | 十几秒 |
| 上述 + 总和接近上限（≥415） | ~1B（多前缀） | 几分钟 |
| OAuth SALT 搜索同上条件 | ~1B（多前缀） | 几分钟到十几分钟 |

---

## SALT 版本追踪

SALT 可能随 Claude Code 版本更新而变化。验证当前 SALT：

```bash
strings "$(readlink -f $(which claude) 2>/dev/null || readlink $(which claude))" | grep 'friend-'
```

如果结果不是 `friend-2026-401`，需要更新脚本中的 SALT 值。更通用的搜索方式（如果 SALT 前缀也变了）：

```bash
# 在二进制中搜索 buddy 相关的短字符串
strings "$(which claude)" | grep -E '^[a-z]+-[0-9]{4}-[0-9]+$' | head -20
```

---

## 操作前检查清单

1. `bun --version` — 确认 bun 已安装
2. 读取 `~/.claude.json` — 确认登录状态和当前 buddy
3. 确认用户想要的目标（物种、稀有度、shiny、属性）
4. 根据登录状态选择路径 A 或 B
5. 执行搜索 → 修改配置/二进制 → 删除 companion → 重启验证
