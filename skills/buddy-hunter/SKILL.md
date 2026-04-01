---
name: buddy-hunter
description: "Help users get their desired Claude Code /buddy companion by brute-forcing the deterministic PRNG seed. Triggers when users mention /buddy, companion, buddy hunting, buddy species, buddy rarity, want a specific buddy, want to change their buddy, reroll buddy, legendary buddy, shiny buddy, or any discussion about customizing Claude Code's companion creature. Also triggers on: 'how do I get a different buddy', 'I want a dragon/axolotl/cat buddy', 'can I change my companion', 'buddy 怎么换', '换 buddy', '想要传说', '想要闪光'."
---

# Buddy Hunter — Claude Code Companion 定制指南

你是帮助用户获取指定 `/buddy` companion 的专家。根据用户的登录状态（OAuth vs 非 OAuth），采用不同的技术路径。

本 skill 自带暴力搜索脚本，位于 `scripts/` 目录下，直接用 `bun` 运行即可，无需手动生成脚本。

## 前置依赖：Bun 运行时

搜索脚本依赖 `Bun.hash()`（Bun 特有的 wyhash 实现），这是 Claude Code 实际使用的哈希函数。Node.js 的 fallback 使用 FNV-1a，产出完全不同的结果，因此**必须用 bun 运行**。

在执行任何搜索之前，先检查 bun 是否可用：

```bash
bun --version
```

如果未安装，**询问用户是否需要帮助安装**，得到确认后执行：

```bash
curl -fsSL https://bun.sh/install | bash
```

安装后需要重新加载 shell（`source ~/.bashrc` 或 `source ~/.zshrc`）。

---

## 核心原理

`/buddy` 的外观属性（species, rarity, eye, hat, shiny, stats）统称为 **Bones**，每次启动时从 `userId` **确定性重新计算**，不存储在配置文件中。

### 算法链路

```
companionUserId() → oauthAccount.accountUuid ?? userID ?? 'anon'
      ↓
key = userId + SALT        // SALT = 'friend-2026-401'
      ↓
Bun.hash(key)              // wyhash, 截取低 32 位
      ↓
mulberry32(seed)           // 确定性 PRNG
      ↓
依次消费随机数：rarity → species → eye → hat → shiny → stats
```

### 数据表

**18 种物种**：duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk

**稀有度权重**：common(60), uncommon(25), rare(10), epic(4), legendary(1)

**Stats 生成**：
- floor 由 rarity 决定：common=5, uncommon=15, rare=25, epic=35, legendary=50
- peak 属性：`min(100, floor + 50 + rand(0~29))`
- dump 属性（≠ peak）：`max(1, floor - 10 + rand(0~14))`
- 其余属性：`floor + rand(0~39)`
- Legendary 理论总和上限：100 + 54 + 89×3 = **421**

**Shiny**：1% 概率。Legendary + Shiny 组合约万分之一。

**配置文件路径**：`~/.claude.json`（注意不是 `~/.claude/config.json`）

---

## 第一步：判断用户登录状态

读取 `~/.claude.json`，检查 `oauthAccount.accountUuid` 是否存在：

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

- 有 `accountUuid` → 走路径 B（OAuth）
- 没有 → 走路径 A（非 OAuth）

---

## 路径 A：非 OAuth 登录（改 userID）

`companionUserId()` 会 fallback 到 `config.userID`，可自由修改。**风险：无。**

### 步骤

1. **确认 bun 可用**（见前置依赖）
2. **运行内置搜索脚本**，根据用户需求传入参数：

```bash
bun <SKILL_DIR>/scripts/search-userid.ts \
  --species axolotl \
  --rarity legendary \
  --shiny \
  --stat WISDOM \
  --min-total 415
```

可用参数：
- `--species <name>` — 目标物种（不传则不限）
- `--rarity <name>` — 目标稀有度（不传则不限）
- `--shiny` — 要求闪光
- `--stat <name>` — 要求某属性 = 100（DEBUGGING/PATIENCE/CHAOS/WISDOM/SNARK）
- `--min-total <n>` — 最低总属性值
- `--salt <value>` — 覆盖 SALT（默认 friend-2026-401）
- `--limit <n>` — 每个前缀的最大搜索量（默认 2 亿）

3. **编辑 `~/.claude.json`**：将 `"userID"` 改为搜索结果中的值
4. **删除 `"companion"` 字段**（强制重新 hatch）
5. **重启 Claude Code**，执行 `/buddy`

---

## 路径 B：OAuth 登录（二进制 SALT 替换）

OAuth 登录时 `accountUuid` 优先且不可修改——来自服务端，有自愈机制。直接改它会导致 API 鉴权失败。

解法：替换二进制中的 **SALT** 字符串（等长替换），使真实 `accountUuid` + 新 SALT 产出目标 buddy。

### 步骤

1. **确认 bun 可用**（见前置依赖）
2. **运行内置搜索脚本**，传入用户的 `accountUuid`：

```bash
bun <SKILL_DIR>/scripts/search-salt.ts \
  --uuid <accountUuid> \
  --species axolotl \
  --rarity legendary \
  --shiny \
  --stat WISDOM \
  --min-total 415
```

参数同路径 A，额外必填 `--uuid`。

3. **定位并备份 Claude Code 二进制**：

```bash
CLAUDE_BIN=$(readlink -f $(which claude) 2>/dev/null || readlink $(which claude))
cp "$CLAUDE_BIN" "${CLAUDE_BIN}.bak"
```

4. **等长替换 SALT**：

```bash
sed -i '' "s/friend-2026-401/<搜索结果中的新SALT>/g" "$CLAUDE_BIN"
```

5. **可选：重新 ad-hoc 签名**（macOS 代码签名失效后可能影响 Keychain）：

```bash
codesign --remove-signature "$CLAUDE_BIN"
codesign -s - "$CLAUDE_BIN"
```

6. **删除 `~/.claude.json` 中的 `"companion"` 字段**
7. **重启 Claude Code**，执行 `/buddy`

### 安全性

**封号风险：极低** — 无运行时自校验，无二进制指纹遥测，SALT 仅用于 buddy 系统。

**实际注意事项**：
- 自动更新会覆盖补丁 → 更新后需重新 patch
- SALT 可能随版本变化 → 验证：`strings "$(which claude)" | grep 'friend-'`

---

## 搜索策略速查

| 需求 | 搜索量级 | 耗时 |
|------|---------|------|
| 指定物种 | ~100 | 秒出 |
| 指定物种 + legendary | ~10K | 秒出 |
| 指定物种 + legendary + shiny | ~1M | 几秒 |
| 上述 + 指定属性 = 100 | ~10M | 十几秒 |
| 上述 + 总和接近上限（≥415） | ~1B（多前缀） | 几分钟 |

---

## 操作前检查清单

1. `bun --version` — 确认 bun 已安装，未安装则询问用户是否帮助安装
2. 读取 `~/.claude.json` — 确认登录状态和当前 buddy
3. 确认用户想要的目标（物种、稀有度、shiny、属性）
4. 根据登录状态选择路径 A 或 B
5. 执行内置搜索脚本 → 修改配置/二进制 → 删除 companion → 重启验证
