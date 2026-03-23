# Build Guidelines – Salon AI

## Purpose
Ensure all development aligns with the long-term vision of Salon AI as an AI-native salon operating system.

This document defines HOW we build, not just what we build.

---

## Required Context

Before implementing any feature, always consider:

- docs/COMPETITOR_BENCHMARK.md
- This file (BUILD_GUIDELINES.md)

---

## Product Vision

Salon AI is not just a scheduler.

It is:
- an AI receptionist
- an intelligent scheduling system
- a client memory engine
- a retention and revenue optimization platform

Every feature must move the system toward this direction.

---

## Core Development Principles

### 1. Intelligence First
Every feature should improve at least one:

- scheduling intelligence
- client intelligence
- revenue intelligence
- automation

If it does not add intelligence, rethink it.

---

### 2. Stability Over Complexity
Prefer:
- simple logic
- predictable behavior
- minimal moving parts

Avoid:
- fragile code
- over-engineering
- unnecessary abstractions

---

### 3. Build on What Exists
- Do not break working features
- Extend existing systems instead of replacing them
- Maintain backward compatibility in database changes

---

### 4. Server-First Architecture
- Use server components whenever possible
- Use Supabase server helpers for reads/writes
- Avoid unnecessary client-side state

---

### 5. Safe Database Practices
- Use:
  - CREATE TABLE IF NOT EXISTS
  - ALTER TABLE ... ADD COLUMN IF NOT EXISTS
- Never drop or overwrite data
- Preserve existing records at all times

---

## Competitive Intent

Every feature must aim to outperform competitors:

- Fresha → better UX and smarter scheduling
- Meevo → same power, less complexity
- Square → deeper salon intelligence
- Vagaro → more modern + AI-driven

---

## UI Philosophy

- Clean, minimal, fast
- Easy to scan for busy stylists
- Avoid clutter
- Prioritize clarity over decoration

---

## Code Expectations

When generating or modifying code:

- Provide full files (not partial fragments)
- Keep code readable and well-structured
- Use clear naming
- Avoid duplication
- Ensure no syntax errors

---

## Feature Checklist

Before finishing any feature, verify:

- Does it improve intelligence?
- Does it align with the product vision?
- Does it outperform at least one competitor?
- Does it avoid breaking existing functionality?
- Is it simple and maintainable?

---

## Output Standard

Every implementation should include:

1. Full code (complete files)
2. Brief explanation of logic
3. How to test the feature manually

---

## Long-Term Direction

Salon AI evolves in layers:

1. Scheduler
2. Client Memory
3. Retention Engine
4. Revenue Intelligence
5. AI Receptionist
6. Automation System
7. Full AI Business Engine

All development should support this progression.