---
date: 2026-10-12
layout: post
publish: true
tags:
- llm
- llama.cpp
- coding-agents
- inference
title: Running Pi Coding Agent on Local Models
---

For the past month I have been running a coding agent entirely on my macbook. No API bill, no rate limits, and it works without internet. The harness I use is [pi](https://github.com/earendil-works/pi), a very minimal coding agent with just four tools (read, bash, edit, write) and a typescript extension system, and the models are served with [llama.cpp](https://github.com/ggml-org/llama.cpp)'s `llama-server`. The first week of this was honestly painful. Every time I wanted to try a different model I had to kill the server, find the right gguf path in my huggingface cache, restart it with a different set of flags, then go and edit pi's config so it knows the model exists. Then I would quit pi and forget the server was still running with 17 GB sitting in memory

The goal of this writeup is to get to a setup where I open pi, pick a model from the `/model` menu, and that model just becomes available. No terminal juggling. If I switch to a different model the old one gets evicted and the new one gets loaded, and when I quit pi the server goes away with it

**Table of Contents:**
- [The Machine and the Models](#the-machine-and-the-models)
- [llama-server in Router Mode](#llama-server-in-router-mode)
- [Model Presets](#model-presets)
- [Telling Pi About the Models](#telling-pi-about-the-models)
- [Starting the Server from Pi](#starting-the-server-from-pi)
- [How Fast Is It](#how-fast-is-it)
- [Things that suck](#things-that-suck)

## The Machine and the Models

I am on an M5 macbook with 32 GB of unified memory. Unified memory means the CPU and GPU share the same pool, so there is no separate VRAM, a model that fits in RAM can be run on the GPU directly. The catch is that macOS does not let the GPU take all of it, by default it only lets the GPU wire somewhere around 70-75% of the total. So on 32 GB I realistically have a little over 20 GB for weights plus the KV cache

I keep two models around for coding:

- **Qwen3.8-27B** quantized to IQ3_S (about 12 GB on disk with the vision projector). It ships with an [MTP](https://arxiv.org/abs/2404.19737) head, which is an extra little head trained to predict the token after the next one, so it can do speculative decoding without a separate draft model
- **Muse Glimmer 30B** at Q4_K_M (about 17 GB) with a separate small DFlash draft model for speculative decoding

If you want to know what IQ3_S and Q4_K_M actually mean I wrote about [quantization and floating point formats](/2026/03/quantization-float-points-turboquant/) a while back. The short version is that both are ways of storing each weight in 3-4 bits instead of 16

Now some napkin math. 12 + 17 = 29 GB just for weights, which is way over my ~20 GB budget, so both models can never be resident at the same time. This one fact drives most of the setup below

## llama-server in Router Mode

Normally you start `llama-server` with a single model:

```bash
llama-server -m some-model.gguf --port 8080
```

This works but it ties one server process to one model, which is exactly the thing I wanted to get rid of. Recent llama.cpp builds have a **router mode**. If you start `llama-server` without `-m`, it does not load anything. Instead it becomes a small router that knows about a set of models, and when a request comes in for a model that is not loaded yet, it spawns a child `llama-server` for that model on a random port and forwards the request to it. You can see this in the logs:

```
srv  ensure_model: model name=muse-glimmer-30B is not loaded, loading...
srv          load: spawning server instance with name=muse-glimmer-30B on port 63040
```

The model name here comes from the `model` field of the request, the same field you would send to the openai api. So from the client's point of view it is just one openai compatible endpoint at `http://127.0.0.1:8080/v1` that happens to serve many models

Two flags matter here. `--models-preset` points the router to an ini file where I describe each model, and `--models-max` sets how many models can be loaded at once. The default is 4, which would happily try to load both my models and run out of memory, so I set it to 1. Now when I ask for qwen while muse is loaded, the router stops muse first and then loads qwen

```bash
llama-server --models-preset ~/.pi/llama-presets.ini --models-max 1 \
  --host 127.0.0.1 --port 8080
```

The router also picks up anything I have ever pulled with `llama-server -hf <repo>` from the huggingface cache, so those models show up too without me writing anything. When it boots it prints the full list, the ones marked with `*` come from my preset file:

```
srv    operator(): Available models (10) (*: custom preset)
srv    operator():     ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF:MTP
srv    operator():     Qwen/Qwen3-VL-8B-Instruct-GGUF:Q4_K_M
srv    operator():   * muse-glimmer-30B
srv    operator():   * qwen3.8-27b
srv    operator():     unsloth/Qwen3-4B-Instruct-2507-GGUF:Q8_0
...
```

## Model Presets

The preset file is where all the flags I used to type by hand now live. Every key in it is just a `llama-server` command line flag without the dashes. The `[*]` section holds shared defaults and every other section is one model, which can override them. This is my `~/.pi/llama-presets.ini`:

```ini
version = 1

; shared defaults; per-model sections override these
[*]
jinja = true
n-gpu-layers = 99
flash-attn = on
cache-type-k = f16
cache-type-v = f16
load-on-startup = false

[muse-glimmer-30B]
model = /Users/darshanmakwana/.cache/huggingface/hub/models--meta-models--Muse-Glimmer-30B-GGUF/snapshots/<hash>/Muse-Glimmer-30B-KQuant-17GB-Q4_K_M.gguf
model-draft = /Users/darshanmakwana/.cache/huggingface/hub/models--meta-models--Muse-Glimmer-30B-GGUF/snapshots/<hash>/dflash-Muse-Glimmer-30B-Q4_K_M.gguf
mmproj = /Users/darshanmakwana/.cache/huggingface/hub/models--meta-models--Muse-Glimmer-30B-GGUF/snapshots/<hash>/mmproj-Muse-Glimmer-30B-Q4_K_M.gguf
spec-type = draft-dflash
spec-draft-n-max = 3
n-gpu-layers-draft = 99
ctx-size = 32768
temp = 1.0
top-p = 0.95
top-k = 64

[qwen3.8-27b]
model = /Users/darshanmakwana/.cache/huggingface/hub/models--ISTA-DASLab--Qwen3.8-27B-GSQ-RCO-GGUF/snapshots/<hash>/Qwen3.8-27B-GSQ-RCO-IQ3_S-mtp.gguf
mmproj = /Users/darshanmakwana/.cache/huggingface/hub/models--ISTA-DASLab--Qwen3.8-27B-GSQ-RCO-GGUF/snapshots/<hash>/mmproj-Qwen3.8-27B-BF16.gguf
spec-type = draft-mtp
spec-draft-n-max = 1
reasoning-format = deepseek
ctx-size = 65536
```

Going through the shared defaults one by one:

- `jinja = true` makes llama.cpp use the chat template that ships inside the gguf. Without this tool calling does not work properly and a coding agent without tool calls is just a chatbot
- `n-gpu-layers = 99` offloads every layer to the GPU. 99 is just a number bigger than the number of layers in any of my models
- `flash-attn = on` uses the fused attention kernel, which saves memory on the attention scores and is faster at long context
- `cache-type-k/v = f16` keeps the KV cache in 16 bit. You can quantize it to `q8_0` to fit more context, I have not needed to yet
- `load-on-startup = false` so nothing gets loaded when the router boots. A model is only loaded the first time someone asks for it

The per-model sections are where things differ. `model` is the weights, `mmproj` is the vision projector that lets the model see images (you can paste screenshots into pi with ctrl+v). Muse uses a separate draft model (`model-draft`) and drafts up to 3 tokens per step, while qwen uses its own MTP head and drafts 1 token. `reasoning-format = deepseek` tells the server to pull qwen's `<think>` block out into a separate `reasoning_content` field instead of leaving it in the reply text, which pi then renders as a separate thinking block you can collapse with ctrl+t. Context size is 32k for muse and 64k for qwen. Muse is the bigger model so it gets less room for the KV cache

## Telling Pi About the Models

pi does not ask the server which models it has. You list them yourself in `~/.pi/agent/models.json` under a provider, and those models show up in the `/model` menu. pi does come with a built-in llama.cpp integration (`/login llama.cpp` and then `/llama`) but in that flow you have to load a model by hand before it appears in `/model`, and I wanted the opposite, models always listed and loaded only when I pick them. So I set it up as a custom openai compatible provider:

```json
{
  "providers": {
    "llama-local": {
      "baseUrl": "http://127.0.0.1:8080/v1",
      "api": "openai-completions",
      "apiKey": "none",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false,
        "maxTokensField": "max_tokens",
        "thinkingFormat": "chat-template",
        "chatTemplateKwargs": {
          "enable_thinking": { "$var": "thinking.enabled" },
          "reasoning_effort": { "$var": "thinking.effort" }
        }
      },
      "models": [
        {
          "id": "qwen3.8-27b",
          "name": "Qwen3.8-27B IQ3_S (llama.cpp, local)",
          "reasoning": true,
          "input": ["text", "image"],
          "contextWindow": 65536,
          "maxTokens": 16384,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
          "samplingParams": {
            "temperature": 0.6,
            "top_p": 0.95,
            "top_k": 20,
            "min_p": 0.0,
            "presence_penalty": 0.0
          },
          "thinkingLevelMap": { "low": "low", "medium": "medium", "xhigh": "xhigh" }
        },
        {
          "id": "muse-glimmer-30B",
          "name": "Muse Glimmer 30B KQuant-17GB + DFlash (llama.cpp, local M5)",
          "reasoning": true,
          "input": ["text", "image"],
          "contextWindow": 32768,
          "maxTokens": 8192,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
          "samplingParams": { "temperature": 1.0, "top_p": 0.95, "top_k": 64 },
          "thinkingLevelMap": {
            "off": null, "minimal": "low", "low": "low", "medium": "medium",
            "high": "high", "xhigh": "xhigh", "max": "xhigh"
          },
          "compat": {
            "supportsDeveloperRole": false,
            "supportsReasoningEffort": false,
            "maxTokensField": "max_tokens",
            "thinkingFormat": "chat-template",
            "chatTemplateKwargs": {
              "reasoning_strength": { "$var": "thinking.effort" }
            }
          }
        }
      ]
    }
  }
}
```

The one thing that has to line up is that the `id` here must be exactly the section name in the preset file. pi sends `"model": "qwen3.8-27b"` in the request, the router looks for a section called `[qwen3.8-27b]`, and if it finds one it loads it. That shared name is what connects the two config files

The `compat` block needs a bit more explanation. pi talks to a lot of different providers and they all disagree on small things. llama.cpp does not understand the `developer` role that newer openai models use for the system prompt, and it wants `max_tokens` and not `max_completion_tokens`. The more interesting part is thinking. These models do not take a `reasoning_effort` api parameter like the openai models do, their chat template reads a variable instead. `thinkingFormat: "chat-template"` tells pi to pass the thinking setting through `chat_template_kwargs`, and `$var` fills in whatever thinking level I have selected in pi. So when I press shift+tab to change the thinking level in pi, qwen's template receives `enable_thinking` and `reasoning_effort`. Muse's template calls the same knob `reasoning_strength`, which is why it overrides `compat` per model. `thinkingLevelMap` maps pi's levels to the strings each template understands

The `samplingParams` are sent with every request and override the server defaults, so for muse I set the same values in both places and for qwen I only set them in pi. The `cost` is all zeros because it is my own electricity : )

Lastly I make it the default in `~/.pi/agent/settings.json` so that plain `pi` starts on the local model:

```json
{
  "defaultProvider": "llama-local",
  "defaultModel": "qwen3.8-27b",
  "defaultThinkingLevel": "medium"
}
```

I also have a couple more providers in the same `models.json` that point to rented GPU boxes running the same qwen with longer context. They have the same shape, just a different `baseUrl` and an api key, which is nice because moving a session from my laptop to a bigger GPU is just a `/model` switch

## Starting the Server from Pi

Now the last piece. pi assumes you have already started a server and it has no setting to launch one for you. I did not want to remember to start the router before opening pi and kill it after, so I wrote a small extension (see `docs/extensions.md` in the pi repo). Extensions are typescript files that pi loads at startup from `~/.pi/agent/extensions/`, and they can hook into session events and register slash commands. This is `~/.pi/agent/extensions/llama-router.ts`:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Local llama.cpp router lifecycle. pi has no built-in way to launch a server
// (docs/llama-cpp.md assumes you started one), so we do it here and tear it
// down on exit -- otherwise a 17 GB model stays resident after pi quits.
const PORT = 8080;
const BASE = `http://127.0.0.1:${PORT}`;
const PRESET = join(homedir(), ".pi", "llama-presets.ini");
const LOG = join(homedir(), ".pi", "llama-router.log");
const BOOT_TIMEOUT_S = 90;

async function isUp(timeoutMs = 1500): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(timeoutMs) });
    return r.ok;
  } catch {
    return false;
  }
}

export default function (pi: ExtensionAPI) {
  // Only kill what we started; a router you launched by hand is left alone.
  let ourPid: number | undefined;

  async function start(): Promise<string> {
    if (await isUp()) return "already running (not started by pi)";
    const fd = openSync(LOG, "a");
    const child = spawn(
      "llama-server",
      ["--models-preset", PRESET, "--models-max", "1",
       "--host", "127.0.0.1", "--port", String(PORT)],
      { detached: true, stdio: ["ignore", fd, fd] },
    );
    child.unref();
    ourPid = child.pid;
    for (let i = 0; i < BOOT_TIMEOUT_S; i++) {
      if (await isUp()) return `started (pid ${ourPid})`;
      await new Promise((r) => setTimeout(r, 1000));
    }
    ourPid = undefined;
    return `failed to become healthy in ${BOOT_TIMEOUT_S}s -- see ${LOG}`;
  }

  function stop(): string {
    if (ourPid === undefined) return "not started by pi; left running";
    const pid = ourPid;
    ourPid = undefined;
    try {
      process.kill(pid, "SIGTERM");
      return `stopped (pid ${pid})`;
    } catch {
      return `already gone (pid ${pid})`;
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    const msg = await start();
    ctx.ui.notify(`llama router: ${msg}`, msg.startsWith("failed") ? "error" : "info");
  });

  // Idempotent: safe across /new, /resume, /fork and quit.
  pi.on("session_shutdown", async () => {
    stop();
  });

  pi.registerCommand("llama-server", {
    description: "start / stop / status the local llama.cpp router",
    handler: async (args, ctx) => {
      const verb = (args ?? "").trim().toLowerCase();
      if (verb === "stop") {
        ctx.ui.notify(`llama router: ${stop()}`, "info");
      } else if (verb === "status") {
        const up = await isUp();
        ctx.ui.notify(
          `llama router: ${up ? "up" : "down"} at ${BASE}; started-by-pi=${ourPid ?? "no"}`,
          up ? "info" : "warning",
        );
      } else {
        ctx.ui.notify(`llama router: ${await start()}`, "info");
      }
    },
  });
}
```

On `session_start` it first checks `/health`. If something is already listening on 8080 it does nothing, otherwise it spawns the router with the preset file and polls `/health` once a second until the router answers. Starting the router is quick because it is not loading any weights yet, the real cost comes later on the first request. All the server output goes to `~/.pi/llama-router.log`, which is where I got all the log lines in this post from

The important design decision is in `stop()`. It only kills the process it started. If I started a router by hand in another terminal, say to serve something else at the same time, pi leaves it alone when it quits. And it uses `SIGTERM` and not `SIGKILL` so the router gets a chance to stop its child model processes too, you can see it do `unload_all: stopping model instance` in the log right before it exits. The `/llama-server status` and `/llama-server stop` commands are there for when I want to free up memory without quitting pi

So the whole flow now looks like this:

1. I run `pi` and the extension starts the router, no model is loaded
2. I send my first message, pi sends a request with `"model": "qwen3.8-27b"`, the router sees it is not loaded, spawns it, and answers
3. I do `/model` and pick muse, the next request asks for `muse-glimmer-30B`, the router stops qwen (because `--models-max 1`) and loads muse
4. I quit pi, the extension sends `SIGTERM`, the router stops muse and exits, and my 17 GB comes back

You can also skip the menu and pick the model and thinking level from the command line with `pi --model llama-local/muse-glimmer-30B:high`

## How Fast Is It

The router log prints timings for every request, so here are the real numbers from my sessions. pi's system prompt plus tool definitions come to about 1.6k tokens, and that is what the first request of every session has to prefill:

| | prefill | generation | draft acceptance |
|---|---|---|---|
| Muse Glimmer 30B + DFlash | ~150 tok/s | 10-13 tok/s | 44-72% |
| Qwen3.8-27B IQ3_S + MTP | ~145 tok/s | 10-11 tok/s | |

So the first message after a model switch takes around 10 seconds before anything happens, just to read the system prompt. After that llama.cpp reuses the KV cache for the shared prefix of the conversation, so following turns only prefill the new tokens. Muse's draft model gets somewhere between 44% and 72% of its drafts accepted, which means on average 2.3 to 3.2 tokens come out of each step of the big model instead of 1. That is the only reason a 30B model runs at reading speed on a laptop

## Things that suck

**1. Every model lives in two files**

To add a model I have to write a section in the preset file and an entry in `models.json`, and the names must match exactly. If I make a typo in one of them the router just says the model does not exist and I go looking through the log. The context size and sampling params are also duplicated, so nothing stops them from drifting apart

**2. Switching models is not free**

With `--models-max 1` every switch is an unload, a load, and then a fresh 1.6k token prefill on top of the whole conversation so far. On a long conversation, say 9k tokens, that is a full minute of prefill at ~150 tok/s before the new model says anything

**3. Prefill is the real bottleneck for agents**

10 tokens per second for generation is fine, I read slower than that. Prefill is what hurts. A coding agent reads a lot of files, and every file it reads gets appended to the context. A 10k token file at ~150 tok/s is about a minute of just reading before the model even says anything. On a GPU box this is a few seconds. This is the main reason I still keep the remote providers around

**4. No auth on the server**

The router prints a warning on every boot that CORS allows all origins and no api key is set. This is fine because it only binds to `127.0.0.1`, but do not change the host to `0.0.0.0` without adding `--api-key`, otherwise anyone on the same wifi gets a free 30B model

Overall I am very happy with this. It feels like using claude code on a slow day, except it is all running on my laptop, and when I quit pi all my memory comes back
