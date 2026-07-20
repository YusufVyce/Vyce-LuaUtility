<div align="center">

# Vyce LuaUtility

### Advanced Runtime Error Analysis Toolkit for Roblox Studio (Luau)

Analyze Roblox runtime errors, identify their root causes, and receive practical debugging guidance.

**Built exclusively for Roblox Studio (Luau).**

<img src="images/preview.png" width="900"/>

<p>
  <a href="https://vyce-lua-utility.vercel.app"><strong>Live Demo</strong></a> •
  <a href="#features"><strong>Features</strong></a> •
  <a href="#example"><strong>Example</strong></a> •
  <a href="#installation"><strong>Installation</strong></a> •
  <a href="#contributing"><strong>Contributing</strong></a>
</p>

</div>

---

# About

Vyce LuaUtility is an open-source developer toolkit built specifically for **Roblox Studio (Luau)**.

Unlike traditional regex-based error parsers, Vyce LuaUtility analyzes runtime errors together with surrounding context to determine the most likely root cause and provide practical debugging guidance.

Instead of only showing **where** an error occurred, it helps explain **why** it occurred and how to resolve it.

> **Important**
>
> This project is designed **exclusively for Roblox Studio (Luau)**.
>
> It is **not** a general-purpose Lua utility library.
>
> It is **not** intended for FiveM, GTA V, Love2D, Defold, Garry's Mod, or any other Lua platform.

---

# What This Project Does

✅ Analyze Roblox runtime errors

✅ Detect likely root causes

✅ Explain why an error happened

✅ Suggest practical debugging steps

✅ Provide Roblox-specific diagnostics

---

# What This Project Does NOT Do

❌ It is **not** a compiler.

❌ It is **not** a static analyzer or linter.

❌ It does **not** automatically fix your code.

❌ It does **not** replace Roblox Studio or Luau's built-in analyzer.

Instead, it focuses on helping developers understand runtime errors faster.

---

# Features

- 🔍 Context-aware runtime error analysis
- 🧠 Root cause detection
- 💡 Practical debugging suggestions
- 📚 Human-readable explanations
- ⚡ Fast analysis engine
- 🛡️ Roblox-specific diagnostics
- 🧩 Support for common Luau runtime errors

---

# Supported Errors

Examples include:

- attempt to index nil
- attempt to call nil
- arithmetic on nil
- invalid argument
- infinite yield
- stack overflow
- table index is nil

...and many more.

---

# Example

### Input

```text
attempt to index nil with 'Health'

Script: EnemyController.lua
Line: 42
```

### Analysis

```text
Root Cause

The variable "enemy" is nil because FindFirstChild() returned nil.

Suggestion

Verify that the object exists before accessing "Health".
```

---

# Tech Stack

- TypeScript
- React
- TanStack Router
- Vite
- Bun

---

# Installation

```bash
git clone https://github.com/YusufVyce/Vyce-LuaUtility.git

cd Vyce-LuaUtility

bun install

bun run dev
```

---

# Contributing

Contributions, bug reports, feature requests, and discussions are always welcome.

Feel free to open an Issue or start a Discussion.

---

# License

Licensed under the GNU General Public License v3.0.
