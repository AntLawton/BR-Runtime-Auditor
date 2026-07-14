# CLAUDE.md

Rules for any AI agent (Cursor, Claude Code, Cowork, or a subagent) working in this repo.

These are not style preferences. Every rule below exists because it has already failed in
this estate, and the failure was found later, by someone else. Read them before you write
code. The canonical source is `AntLawton/FitToCareBrain`, `00-Home/gate/` (this file) and
`07-Products/Zero-Trust-Flow-Standard.md`.

---

## 0. What this file is, and what it is not

**This file is ADVISORY. Rules 1 to 7 below are not enforced by anything.** Nothing stops you
ignoring them, and nothing will block your pull request if you disregard every word.

That is stated up front because a rules file that opens with a false claim teaches you to discount
the rest of it, and the rest of it is true and hard-won.

**So why bother?** Because an agent that has never been told the rules breaks them every single
time. Advisory rules are not as good as a gate. They are enormously better than nothing.

**A machine-enforced gate (the Load-Bearing Gate) is being rolled out separately.** It is described
at the end of this file. **Do not assume it is active in THIS repo**: it only blocks a merge where it
is configured as a required status check on a protected branch, and rollout is incomplete. Check
before you rely on it. Until it is live here, the only thing standing between a defect and production
is you.

---

## 1. Never leave the human load-bearing (the one rule that matters most)

**Anthony Lawton owns this estate. He is not technical, and he is the only human here.**

It is NEVER his job to remember a technical follow-up. If your design's final step is
"and then Anthony checks / remembers / runs the script / clicks the thing", **your design
is wrong.** The system must act on its own, or halt loudly and summon him by name.

Handing a technical to-do to a non-technical owner is a failed session, not a delivered one.
A live admin password once sat unfired in a backlog for a week, and production ran three-day-stale
code, both because closing the loop was quietly left to a human.

If you cannot automate it: **halt and say so, loudly, in plain English.** Do not write it down
and move on. A finding without a mechanism is just a nicer way to forget.

## 2. Zero-Trust Flow: no step may witness its own success

The defect never lives inside a step. It lives in the **handoff between two steps that are
each individually green.** On 14 July 2026 a fix in this estate was written, red-teamed by two
independent gates, tested, merged, deployed and reported successful, **while doing nothing at all.**

1. **No step reports its own success. The NEXT STATE is the only witness.** Do not ask "did the
   deploy succeed", ask "what revision is live". Do not ask "did the tests pass", ask "have they
   ever failed". Do not ask "does it alarm", ask "is the email in the inbox".
2. **A green tick is an INPUT to the question, never the answer.** CI green, workflow success,
   "DONE", exit code 0, your own confident summary: all are claims. They may be true. They are
   not evidence.
3. **Map the whole flow and name every handoff.** brief -> code -> test -> review -> merge ->
   deploy -> live -> observed -> alarmed -> human. For every arrow ask: what proves this arrow
   happened, and who checks it? An arrow with no independent witness is where the next failure will be.
4. **The plant test is the only proof a gate bites.** A gate that has never refused anything is a
   decoration. Remove the guard and watch the tests go red. Plant a fault and watch the email arrive.
   Attempt the forbidden read and watch it be refused. **A green suite that has never been red proves
   nothing.** Run plant tests on a branch, an emulator, a scratch project or a test double, and NEVER
   by firing a destructive action at a live system.
5. **Never verify from inside the system you are verifying.** A transcript can swallow its own output.
   A mount can serve a stale file. `gcloud` can silently fall back to a human's credentials after the
   service-account auth failed, and look green. A builder will pass its own work.
6. **A fix nobody hears is theatre. Name the listener.** "It fails loudly" is not a safeguard until you
   can say WHO or WHAT hears the failure. If the answer is "the error log", the answer is nobody.
7. **The machine closes the loop, never the human.** (See rule 1.)

## 3. Proportionality: ceremony scales with blast radius, and nothing else

Rules 2 and 4 are expensive. They are not free, and they are not always worth it. **State your
blast-radius tier in one line before you start, and match the ceremony to it.**

- **FULL** (two gates, a plant test, an independent audit by a different agent, a flow map):
  anything irreversible, multi-repo, production, or touching personal data, safeguarding or
  clinical-risk disclosures, money, a statutory clock, a deploy path, a secret, or a
  client-facing system.
- **NONE**: a genuinely reversible single-file change (the diff AND the real-world effect are both
  undoable), a docs or prose edit, a read-only review, research, drafting. Do the thing, say you
  did it, move on.
- **In between**: say which tier you chose and why. If you cannot say why the ceremony is
  proportionate, it is not.

**Check the FULL list first: file count never overrides a FULL trigger.** A one-line change to a
deploy workflow, a rules file or an IAM binding is FULL, however small the diff. This estate's two
worst defects were tiny: `default: 'dev'` on one line shipped dev to production, and one missing
owner filter exposed every client's project.

**Never capped, at any tier, because each is free**: rule 1 (never leave the human load-bearing),
and rule 4's "the builder never audits its own work".

**Why this rule exists**: a safety system that feels like a tax gets switched off, and a safety
system that is switched off protects nothing. Over-auditing is not the safe error.

## 4. Every brief opens with the Stage 0 question: "What is this brief NOT asking?"

Every gate inherits the frame of the brief it is given. Two independent gates can both pass a change
and still miss the hole beside it.

A session in this estate was briefed to retire a static shared token. It did exactly that, thoroughly,
and verified it live. It never asked whether the authorisation model underneath was sound. It was not:
any logged-in user could read every client's project and take working credentials for another client's
workshop. **The brief closed a door beautifully and never asked whether the house had walls.**

Answer the question in writing, before you write a line. What is adjacent to this fix that nobody has
been asked to look at? What would an attacker try that this brief never mentions? Cap it at the three
most consequential things: this is a scoping challenge, not a licence to widen the job.

**A scoped fix with no scoping challenge is how a security session leaves a security hole.**

## 5. Two gates, and the builder never audits its own work

- **Stage 0**: red-team the BRIEF against the actual repo, before anything is built. Wrong assumptions,
  missed targets, over-broad permissions, and the Stage 0 question above.
- **Stage 2**: an INDEPENDENT agent audits the diff after the build. Fidelity to the agreed design,
  scope creep, runtime behaviour, security.

The model that builds a thing never audits it. In Cursor: `composer-2.5` for bounded builds;
`claude-sonnet-5` for reasoning and audit by default, and `claude-opus-4-8` when the blast radius is
FULL. Do not use `claude-fable-5`.

**Audit infrastructure by RUNNING the real tooling, never by reading the config.** Insight Genie's deploy
workflow had never once executed in the repo's history, and an audit that actually ran it found 8 defects,
3 fatal, every one sitting behind a green CI tick.

## 6. Definition of done

A task is not done when the code is written. It is done when:

- the change is merged AND **the live state has been read back and proves it landed** (merged and live
  are different sentences: production once ran two-week-old code for 90 minutes after a "successful" merge);
- any gate, test or alarm it relies on has been **plant-tested**, so you know it bites;
- the failure path has a **named listener** that is a machine, not a human's memory;
- nothing is left for Anthony to remember.

## 7. Anything handed to Anthony: ASCII only, and no `&&`

He runs Windows PowerShell 5.1, which rejects `&&`, and em dashes arrive mangled through the console.
One command per line. If a script prints "DONE" it must have proved something first: a PowerShell
transcript once silently swallowed every result and printed DONE, proving nothing.

---

## Where these rules live

This file is generated from `AntLawton/FitToCareBrain`, `00-Home/gate/CLAUDE.md`, and copied into every
repo alongside `.cursor/rules/00-fit-to-care.mdc`, which carries the same content in the format Cursor
loads automatically.

**If a rule is wrong, fix it at source and re-run the rollout.** Do not edit the local copy: it will be
overwritten, and a rule that can be quietly softened in one repo is not a rule.

**Other rules files in this repo** (`.cursorrules`, other `.cursor/rules/*.mdc`) are not ours and are not
superseded by this one. Read them too.

---

## The Load-Bearing Gate (the machine that enforces rule 1)

This is the mechanism, not the advice. It asks ONE question of every pull request:

**Does this change introduce, or leave in place, any point where a human must remember or manually act
for the system to stay correct, safe, or live?**

It hunts **absences**: routes with no owner filter, jobs with no failure path, deletions with no retry,
fixes nobody hears when they fail. The absences it remembers, because they happened here: citizen erasure
that failed OPEN while the audit log looked truthful; a deploy that shipped `dev` because a workflow default
was wrong; Dynamic Genie with no tenancy model, where any user could read every client's projects and
credentials; an alarm that threw into a void; National Heartbeats erasure with no retry and no loud halt.

**Architecture.** Layer 1 (`.github/gate/load_bearing_gate.py`) is deterministic and blocking, holds no
secrets, and runs on every pull request including forks. Layer 2 (`.github/gate/judge.py`) is Sonnet-class
judgement via the Anthropic API; it runs only in `load-bearing-gate-judge.yml` in the BASE repo context, and
never checks out or executes pull-request head code.

**Verdicts.** CLEAR (no load-bearing human dependency found). WATCH (advisory, merge allowed, noted in the
comment). FLAG (blocks the merge). **UNVERIFIED also blocks, deliberately: it means the gate could not see,
and a check that could not look is not a check that passed.**

**Prompt injection.** Diff content is UNTRUSTED DATA between delimiters. It cannot change the rules or the
meaning of a verdict. Layer 1 flags diff lines that address the reviewer, and the model must report any
injection attempt in its structured output.

**Binding.** The check run is named exactly `load-bearing-gate`. It only BLOCKS merges where it is configured
as a required status check on a protected branch. Until rollout completes, the Watchman tracks which repos are
still ungated.

**If the gate is wrong, fix the gate, not the pull request.** It is managed centrally in
`AntLawton/FitToCareBrain`, `00-Home/gate/`. A gate that can be quietly softened in one repo is not a gate.
