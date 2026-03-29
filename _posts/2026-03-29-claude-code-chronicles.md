---
date: 2026-03-29
layout: post
publish: true
tags:
- claudecode
- ai
- productivity
- anthropic
title: Claude Code Chronicles
---

A couple of months back I was facing a kernel panic "Unable to mount root fs" while rebooting by ubuntu with normal mode, I found a quick workaround via recovery mode by dropping to root shell and patching some systemd files to boot with an older kernel version. This is how I had been restarting my computer since then. Today I saw by brightness keys where somehow not functioning at all, I dropped into a root shell and asked claudecode to fix it, left for lunch and then cameback an hour later I noticed all my terminals where gone and my browser closed

I opened up a new terminal and ran `claude -c` and started reading what claude essentially did, so it fixed the brigtness issue,  but then it also noticed that I am in recovery mode, questioned why was I in recovery mode, ran some bash commands and later deduced that `initramfs` files where never generated and thus NVMe storage drivers couldn't be loaded in normal mode so kernel would always panik, it fixed the issue by generating the files and then rebooted my computer, the last command which was registered in my `~/.bash_history` was `reboot`

---

Asked claude code to apply for my visa application(inside a headed browser so I can monitor alongside). Used a [browser cli skill](https://github.com/vercel-labs/agent-browser) for interacting with chromium which has all my profiles and session ids logged in. Requires credentials for the visa portal log in. Claude starts searching for credentials, opened my obsidian vault, greped for files with visa in the name, there was indeed a file where I had stored my visa credentials. Took the credentials and then logged in as usual and started filling my application. Ig claude's [automemory](https://code.claude.com/docs/en/memory) feature remembered how I use obsidian and store my notes and probably figured I might have stored my them somewhere for him to use