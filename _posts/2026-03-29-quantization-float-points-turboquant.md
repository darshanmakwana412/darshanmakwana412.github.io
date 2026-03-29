---
date: 2026-03-29
layout: post
publish: true
tags:
- llm
- quantization
- ml
- inference
title: Quantization, Floating Points and TurboQuant
---

A lot of effort is spent to make LLM inference cheaper and performant. [Quantization](https://huggingface.co/docs/optimum/en/concept_guides/quantization) is the standard way to do this, where we reduce model's size by representing it with parameters with fewer bits so they take up less memory and move faster through the memory hierarchy. The progression from 32-bit -> mixed precision -> 16-bit -> 8-bit -> 4-bit formats has been one of the most impactful practical developments in LLM inference
## Floating Point Formats

A [floating point](https://en.wikipedia.org/wiki/Floating-point_arithmetic) number consists of a sign bit, $E$ exponent bits and $M$ mantissa bits. If $e$ is the value of the exponent bits (potentially [biased](https://en.wikipedia.org/wiki/Exponent_bias)) and $m$ is the value of the mantissa bits, the represented value is

$$
f = \text{sign} \cdot 2^e \cdot \left(1 + \frac{m}{2^M}\right)
$$

The exponent determines the rough scale of the number and the mantissa determines the precise value within that scale. Standard [float32](https://en.wikipedia.org/wiki/Single-precision_floating-point_format) uses $E = 8, M = 23$ for 32 bits total. This is the reference precision for most LLM training

For 16-bit inference it has become popular to use [bfloat16](https://en.wikipedia.org/wiki/Bfloat16_floating-point_format) ($E = 8, M = 7$) over traditional [float16](https://en.wikipedia.org/wiki/Half-precision_floating-point_format) ($E = 5, M = 10$). The key reason is that bfloat16 preserves the same exponent range as float32, so quantizing from float32 to bfloat16 is straightforward, we can just truncate the mantissa. Having a wider dynamic range matters more than fine grained precision for ML workloads where gradients and activations can span several orders of magnitude.

## NVFP4 and the Limits of Scalar Quantization

Things gets interesting when we go below 8 bits, with 4 bits we can only represent 16 distinct values. At that point it is not even obvious that anything useful can be preserved. [NVFP4](https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/) is NVIDIA's answer to this, and it pushes scalar quantization to the extreme

NVFP4 is not really a standalone data type. It is a format for an entire [tensor](https://docs.pytorch.org/docs/stable/tensors.html). Each element is stored as a 4-bit float ($E = 2, M = 1$) but the tensor also carries an 8-bit scaling factor for every 16 elements and a single 32-bit scaling factor for the whole tensor. The per-block scale captures the local magnitude distribution and the per-tensor scale captures the global one. Together they compensate for the limited range of 4 raw bits.

The overhead works out to about 0.5 extra bits per element (the 8-bit scale amortized over 16 values), bringing effective storage to 4.5 bits per weight. NVIDIA built hardware support for this into the [Blackwell architecture](https://www.nvidia.com/en-us/data-center/technologies/blackwell-architecture/) so the complexity is an abstraction for CUDA kernel developers.
## TurboQuant

TurboQuant is a recently popular vector quantization algorithm. It takes a vector of numbers and produces a quantized version that uses less memory. At its core the idea is pretty simple, before apply quantization apply a random rotation in an n-dimensional vector space that it lives in and for dequantization apply the corresponding reverse quantization. This rotation is not learned, not input-dependent, not sampled from some special distribution. It is just a random orthogonal transformation. And it dramatically improves quantization quality

TurboQuant then uses a second correction step for eliminating bias in the attention block computation, I haven't read about it entirely yet but they use [Quantized Johnson-Lindenstrauss](https://arxiv.org/abs/2504.19874) transform to preserve dot products accurately, and provide theoretical guarantess to support it

**References:**

1. [TurboQuant: Online Vector Quantization (Zandieh et al. 2025)](https://arxiv.org/abs/2504.19874)
2. [NVFP4 for Efficient Low-Precision Inference - NVIDIA](https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/)