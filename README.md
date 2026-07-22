<div align="center">

# Vyce LuaUtility

### AST-Powered Runtime Diagnostics for Roblox Studio (Luau)

Offline runtime error analysis with semantic understanding, root cause detection, and actionable debugging guidance.

**Built exclusively for Roblox Studio (Luau).**

<img src="images/görsel_2026-07-22_045124401.png" width="1920"/>

<p>
  <a href="https://parser.vyce.studio"><strong>🌐 Website</strong></a> •
  <a href="#features"><strong>✨ Features</strong></a> •
  <a href="#architecture"><strong>🏗 Architecture</strong></a> •
  <a href="#example"><strong>📖 Example</strong></a> •
  <a href="#installation"><strong>💻 Installation</strong></a> •
  <a href="#roadmap"><strong>🛣 Roadmap</strong></a>
</p>

</div>

---

# About

Vyce LuaUtility is an open-source runtime diagnostics engine built specifically for **Roblox Studio (Luau)**.

Unlike traditional analyzers that rely primarily on regex matching, Vyce LuaUtility parses Luau source code into a lightweight Abstract Syntax Tree (AST), extracts semantic information, and combines it with runtime error data to determine the most likely root cause.

Everything runs locally.

No AI.

No API keys.

No cloud services.

No internet connection required.

Its purpose is not only to tell you **where** an error occurred—but to explain **why** it happened and how to fix it.

---

# Features

- 🌳 Lightweight Luau AST parser
- 🧠 Semantic runtime analysis
- 🔍 Context-aware root cause detection
- 💡 Practical debugging suggestions
- 📚 Human-readable explanations
- ⚡ Fully offline execution
- 🛡 Roblox-specific diagnostics
- 📈 Confidence-based hypothesis ranking
- 🔒 No AI or external services
- 🧩 Extensible diagnostics pipeline

---

# Architecture

```
Console Error
        │
        ▼
Normalization
        │
        ▼
Error Classification
        │
        ▼
Lexer
        │
        ▼
Tokenizer
        │
        ▼
Parser
        │
        ▼
Luau AST
        │
        ▼
Semantic Analysis
        │
        ▼
Evidence Engine
        │
        ▼
Hypothesis Engine
        │
        ▼
Confidence Scoring
        │
        ▼
Explanation Generator
        │
        ▼
Fix Generator
```

The runtime analysis pipeline is fully deterministic and executes locally without external dependencies.

---

# Supported Analysis

Examples include:

- attempt to index nil
- attempt to call nil
- arithmetic on nil
- invalid argument
- infinite yield
- stack overflow
- table index is nil
- invalid service
- invalid class
- coroutine errors
- module loading issues

...and many more.

---

# Example

### Input

```text
attempt to index nil with 'Health'

Script: EnemyController.lua
Line: 42
```

### Output

```text
Root Cause

FindFirstChild() returned nil, therefore the "enemy" reference was never assigned.

Evidence

The analyzer detected an object lookup without a successful assignment before property access.

Suggestion

Verify the object exists before accessing enemy.Health.

Confidence

94%
```

---

# Why Vyce LuaUtility?

Most runtime analyzers stop after recognizing an error message.

Vyce LuaUtility goes further by understanding the surrounding Luau code structure through semantic analysis, allowing it to generate more accurate explanations and practical debugging guidance.

The project is designed around three principles:

- Deterministic diagnostics
- Roblox-first development
- 100% offline execution

---

# Tech Stack

- TypeScript
- React
- Vite
- TanStack Router
- Bun

---

# Installation

```bash
git clone https://github.com/YusufVyce/Vyce-Luau-ErrorAnalyzer.git

cd Vyce-LuaUtility

bun install

bun run dev
```

---

# Roadmap

## Completed

- ✅ Lightweight Luau parser
- ✅ AST generation
- ✅ Semantic analysis engine
- ✅ Evidence engine
- ✅ Hypothesis engine
- ✅ Confidence scoring
- ✅ Human-readable explanations
- ✅ Roblox-specific diagnostics
- ✅ Fully offline runtime analysis

## Planned

- More Luau syntax coverage
- Additional Roblox API semantics
- Expanded diagnostics database
- Roblox Studio plugin
- Performance optimizations
- Community-contributed diagnostics

---

# Contributing

Contributions are welcome.

You can help by:

- Reporting bugs
- Improving parser coverage
- Adding new diagnostics
- Improving semantic analysis
- Expanding Roblox API support
- Opening pull requests

---

# License

Licensed under the GNU General Public License v3.0.
