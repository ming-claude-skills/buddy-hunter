# Buddy Hunter

帮你在 Claude Code 中获取梦想中的 `/buddy` 伙伴。

## 这是什么？

Claude Code 的 `/buddy` 命令会根据你的用户 ID 确定性地生成一个伙伴。物种、稀有度、属性和外观都是固定的——重复执行 `/buddy` 不会改变结果。

这个插件逆向了 PRNG 算法，通过暴力搜索找到能产出你想要的伙伴的种子。想要一只 **WISDOM 拉满的传说闪光六角恐龙**？没问题。

## 安装

### 快速安装

在终端中运行：

```bash
claude plugin marketplace add ming-claude-skills/buddy-hunter
```

### 手动安装（在 Claude Code 中）

在 Claude Code 中**逐条执行**以下命令：

```
/plugin marketplace add ming-claude-skills/buddy-hunter
/plugin install buddy-hunter@buddy-hunter
/reload-plugins
```

## 使用

直接调用 skill：

```
/buddy-hunter
```

或者用自然语言描述你想要什么：

- "我想要一个传说闪光六角恐龙 buddy"
- "帮我抽到最稀有的 buddy"
- "换一个 legendary dragon buddy"
- "我想要 WISDOM 满值的 buddy"

Claude 会：
1. 检查你的登录方式（OAuth 还是 API Key）
2. 运行对应的暴力搜索脚本
3. 引导你修改配置
4. 重启 Claude Code，执行 `/buddy`，享受！

## 工作原理

### 算法

```
userId + SALT → Bun.hash() → mulberry32 PRNG → 稀有度 → 物种 → 眼睛 → 帽子 → 闪光 → 属性
```

一切都是确定性的。相同输入 = 相同伙伴，永远如此。

### 两条路径

| 登录方式 | 方法 | 风险 |
|---------|------|------|
| **API Key / 未登录 OAuth** | 修改 `~/.claude.json` 中的 `userID` | 无 |
| **OAuth 登录** | 等长替换二进制中的 SALT 字符串 | 极低（仅影响装饰性功能，无遥测上报） |

### 可用物种（18 种）

duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk

### 稀有度

| 稀有度 | 权重 | 概率 |
|--------|------|------|
| Common | 60 | 60% |
| Uncommon | 25 | 25% |
| Rare | 10 | 10% |
| Epic | 4 | 4% |
| Legendary | 1 | 1% |

闪光概率：1%。Legendary + Shiny 组合概率约 0.01%。

### 属性

5 项属性：DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK

- Legendary 基础值：50（Common 仅为 5）
- 一项巅峰属性（最高 100），一项低谷属性（Legendary 为 40-54），其余 50-89
- **理论总和上限：421**

## 前置要求

- [Bun](https://bun.sh/) 运行时（搜索脚本**必须**用 Bun 运行，不能用 Node.js —— Claude Code 使用 `Bun.hash()` (wyhash)，与 Node.js 的 FNV-1a 结果完全不同）

## 注意事项

- SALT 值（`friend-2026-401`）可能随 Claude Code 版本更新而变化，skill 中包含从二进制提取最新 SALT 的方法。
- OAuth 用户：自动更新会覆盖二进制补丁，更新后需重新 patch。
- 本插件仅影响装饰性的 `/buddy` 伙伴，不修改任何功能行为、API 调用或计费。

## 许可证

MIT
