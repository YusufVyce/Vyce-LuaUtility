# Error Parser Solution Guide

Lightweight web tool to analyze runtime errors and suggest fixes for Roblox, Unity, Discord.js, and Minecraft (Paper).

- Short: Paste an error and related code, click Analyze.
- Author: Made by YusufVyce

## Quick start

```bash
bun install
bun run dev
```

Repository: https://github.com/YusufVyce/error-parser-solution-guide

## Analyzer

The app now includes a semantic root-cause analysis engine that reasons about async behavior, control flow, and data flow instead of relying solely on keyword matching.

## Testing

Run the analyzer test suite locally:

```bash
npm test
```
