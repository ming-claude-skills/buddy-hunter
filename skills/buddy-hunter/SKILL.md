---
name: buddy-hunter
description: "Help users get their desired Claude Code /buddy companion by brute-forcing the deterministic PRNG seed. Triggers when users mention /buddy, companion, buddy hunting, buddy species, buddy rarity, want a specific buddy, want to change their buddy, reroll buddy, legendary buddy, shiny buddy, or any discussion about customizing Claude Code's companion creature. Also triggers on: 'how do I get a different buddy', 'I want a dragon/axolotl/cat buddy', 'can I change my companion', 'buddy 怎么换', '换 buddy', '想要传说', '想要闪光'."
---

# Buddy Hunter — Claude Code Companion 定制指南

你是帮助用户获取指定 `/buddy` companion 的专家。本 skill 自带暴力搜索脚本（`scripts/` 目录下），直接用 `bun` 运行。

## 交互原则

**每一步涉及用户确认的操作，都必须使用 `AskUserQuestion` 工具来获取用户的明确同意后再执行。** 不要假设用户同意，不要跳过确认步骤。需要确认的场景包括但不限于：
- 安装 bun 运行时
- 确认搜索目标（物种、稀有度、属性等）
- 修改 `~/.claude.json` 配置文件
- 备份和修改 Claude Code 二进制文件
- 重新签名二进制文件

## Workflow 总览

**在开始工作前，先用 `TaskCreate` 创建以下任务清单，并在执行过程中用 `TaskUpdate` 逐步更新状态，让用户随时了解进展。**

总共 6 个步骤：

1. **检查环境** — 检查 bun 是否安装，未安装则询问用户是否帮助安装
2. **读取当前状态** — 读取 `~/.claude.json`，判断登录方式，展示当前 buddy 信息
3. **确认目标** — 询问用户想要什么样的 buddy（物种、稀有度、shiny、属性偏好）
4. **执行搜索** — 运行内置脚本，搜索最优解
5. **应用结果** — 根据登录方式修改配置或二进制（每步操作前确认）
6. **验证** — 提示用户重启 Claude Code 并执行 `/buddy` 查看结果

根据步骤 2 的结果，步骤 5 会走不同的路径：
- **非 OAuth** → 路径 A：修改 `~/.claude.json` 中的 `userID`
- **OAuth** → 路径 B：等长替换二进制中的 SALT 字符串

---

## 步骤 1：检查环境

检查 bun 是否可用：

```bash
bun --version
```

如果未安装，用 `AskUserQuestion` 询问：

> bun 运行时未安装。搜索脚本依赖 Bun.hash()（Claude Code 实际使用的哈希函数），必须用 bun 运行。是否帮你安装 bun？

得到确认后执行：

```bash
curl -fsSL https://bun.sh/install | bash
```

安装后需要重新加载 shell（`source ~/.bashrc` 或 `source ~/.zshrc`）。

---

## 步骤 2：读取当前状态

读取 `~/.claude.json`，获取登录状态和当前 buddy 信息：

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

向用户展示：
- 当前登录方式（OAuth / 非 OAuth）
- 当前 buddy 信息（如果有）
- 将要使用的路径（A 或 B）

如果是 OAuth 登录，告知用户路径 B 需要修改 Claude Code 二进制文件，用 `AskUserQuestion` 确认是否继续。

---

## 步骤 3：确认目标

用 `AskUserQuestion` 询问用户想要的 buddy 属性。如果用户在初始消息中已经说明了目标，则展示解读结果并确认。

需要确认的项目：
- **物种**：18 种可选 — duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk
- **稀有度**：common / uncommon / rare / epic / legendary
- **Shiny**：是否要求闪光（1% 概率，搜索时间更长）
- **属性偏好**：是否要求某个属性满值 100（DEBUGGING / PATIENCE / CHAOS / WISDOM / SNARK）
- **总属性值**：是否要求接近理论上限 421（越高搜索越久）

给出搜索耗时预估：

| 需求 | 耗时 |
|------|------|
| 指定物种 | 秒出 |
| + legendary | 秒出 |
| + shiny | 几秒 |
| + 指定属性 = 100 | 十几秒 |
| + 总和 ≥ 415 | 几分钟 |

---

## 步骤 4：执行搜索

根据路径选择对应脚本。`<SKILL_DIR>` 替换为本 skill 的实际目录路径。

**搜索前给用户一些趣味提示**（根据搜索难度选择）：
- 简单搜索（指定物种）："`正在翻找...应该很快！`"
- 中等搜索（+ legendary + shiny）："`开始搜索...去倒杯咖啡吧 ☕`"
- 困难搜索（+ 属性满值 + 总和 ≥ 415）："`全力搜索中...你的电脑风扇可能要起飞了 🛫 建议趁这段时间摸摸你家的猫/狗/仓鼠`"

### 执行策略：后台运行 + 增量确认

搜索脚本会增量输出——每找到更优的结果就打印一行。**对于困难搜索（legendary + shiny + 属性满值等），使用后台运行模式，边搜边问用户是否满意，避免长时间阻塞。**

具体流程：

1. **使用 `run_in_background: true` 启动搜索脚本**（Bash 工具参数）
2. **等待约 15-30 秒后，读取输出文件**（Read 工具，路径在 Bash 返回的元数据中）检查是否已有结果
3. **如果有结果，用 `AskUserQuestion` 展示当前最优结果并询问**：
   > 当前搜索到的最优结果：
   > - \<species\> \<rarity\> \<shiny\>
   > - 总属性值：\<total\>/421
   > - 属性分布：\<stats\>
   >
   > 搜索仍在后台继续，可能找到更好的。你想：
   > A) 就用这个！
   > B) 再等等，看看有没有更好的
4. **如果用户选择 A**：使用 `kill` 终止后台脚本进程，进入步骤 5
5. **如果用户选择 B**：再等 30-60 秒后重复步骤 3
6. **如果脚本已自然结束**（找到 total ≥ 418 或搜索完毕）：直接展示最终结果并确认

对于简单搜索（秒出结果），不需要后台模式，直接前台运行即可。

### 脚本命令

路径 A（非 OAuth）：

```bash
bun <SKILL_DIR>/scripts/search-userid.ts \
  --species <物种> \
  --rarity <稀有度> \
  [--shiny] \
  [--stat <属性名>] \
  [--min-total <最低总值>]
```

路径 B（OAuth）：

```bash
bun <SKILL_DIR>/scripts/search-salt.ts \
  --uuid <accountUuid> \
  --species <物种> \
  --rarity <稀有度> \
  [--shiny] \
  [--stat <属性名>] \
  [--min-total <最低总值>]
```

脚本可用参数：
- `--species <name>` — 目标物种（不传则不限）
- `--rarity <name>` — 目标稀有度（不传则不限）
- `--shiny` — 要求闪光
- `--stat <name>` — 要求某属性 = 100
- `--min-total <n>` — 最低总属性值
- `--salt <value>` — 覆盖当前 SALT（默认 friend-2026-401）
- `--limit <n>` — 每个前缀的最大搜索量（默认 2 亿 / 1 亿）

---

## 步骤 5：应用结果

### 路径 A（非 OAuth）：修改 userID

用 `AskUserQuestion` 确认：

> 将要修改 ~/.claude.json：
> - 设置 userID 为 "<搜索到的值>"
> - 删除 companion 字段（触发重新生成）
>
> 是否继续？

确认后执行修改。

### 路径 B（OAuth）：替换二进制 SALT

此路径涉及多个敏感操作，每步都需要用 `AskUserQuestion` 确认。

**5a. 定位并备份二进制**

```bash
CLAUDE_BIN=$(readlink -f $(which claude) 2>/dev/null || readlink $(which claude))
```

用 `AskUserQuestion` 确认：

> Claude Code 二进制路径：<路径>
> 将要创建备份：<路径>.bak
>
> 是否继续？

确认后备份：

```bash
cp "$CLAUDE_BIN" "${CLAUDE_BIN}.bak"
```

**5b. 替换 SALT**

用 `AskUserQuestion` 确认：

> 将要在二进制中执行等长替换：
> - 原 SALT："friend-2026-401"
> - 新 SALT："<搜索到的值>"
>
> 这是安全的：等长替换不改变文件大小，SALT 仅用于 buddy 系统，不影响 API、鉴权或计费。
>
> 是否继续？

确认后执行：

```bash
sed -i '' "s/friend-2026-401/<新SALT>/g" "$CLAUDE_BIN"
```

**5c. 可选：重新签名**

用 `AskUserQuestion` 询问：

> 二进制修改后 macOS 代码签名已失效。建议重新 ad-hoc 签名以避免 Keychain 访问问题。是否执行？

确认后执行：

```bash
codesign --remove-signature "$CLAUDE_BIN"
codesign -s - "$CLAUDE_BIN"
```

**5d. 修改配置**

用 `AskUserQuestion` 确认：

> 将要删除 ~/.claude.json 中的 companion 字段（触发重新生成）。是否继续？

确认后执行修改。

### 安全性说明（路径 B）

**封号风险：极低** — 无运行时自校验，无二进制指纹遥测，SALT 仅用于 buddy 系统。

**实际注意事项**：
- 自动更新会覆盖补丁 → 更新后需重新 patch
- SALT 可能随版本变化 → 验证：`strings "$(which claude)" | grep 'friend-'`

---

## 步骤 6：验证

用 `AskUserQuestion` 告知用户：

> 配置已完成！请执行以下操作：
> 1. 重启 Claude Code
> 2. 执行 `/buddy` 查看你的新伙伴
>
> 如果结果不符合预期，可以随时回来重新搜索。备份文件在 <备份路径>（路径 B）。

---

## 核心原理（参考）

`/buddy` 的外观属性（species, rarity, eye, hat, shiny, stats）统称为 **Bones**，每次启动时从 `userId` 确定性重新计算，不存储在配置文件中。

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
