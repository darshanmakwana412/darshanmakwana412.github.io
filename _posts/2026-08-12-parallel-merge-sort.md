---
date: 2026-08-12
layout: post
publish: true
tags:
- algorithms
- cpp
- parallel-computing
- performance
title: Efficient Parallel Merge Sort Implementation
---

I have been having a lot of fun on weekends writing classicial algorithms by hand without the help of any coding agents, this is an attempt of a writeup of my parallel merge sort implementation. Merge sort is one of the easiest algorithms to parallelize because inherently it divides the work into smaller subproblems that can be solved independently. I also have a parrallel quick sort implementation which is quite fascinating to understand but I will write it up in a separate post. Also this reminds me the very first post I wrote on this blog was a [parallel median filter implementation](/2025/09/median-filter-over-arbitrary-datatypes/) that works over arbitrary datatypes such fun times those were a year back : )

**Table of Contents:**
- [V1: Just Sort The Thing](#v1-just-sort-the-thing)
- [V2: Let The Recursion Fan Out](#v2-let-the-recursion-fan-out)
- [V3: Cutting The Branch (And Breaking Everything)](#v3-cutting-the-branch-and-breaking-everything)
- [V4: Going Wide With AVX-512](#v4-going-wide-with-avx-512)

## V1: Just Sort The Thing

Standard top down merge sort. Split the array in half, recurse on each half, merge the two sorted halves back together. The only real decision here is when to stop recursing, past a certain point the array is small enough that the overhead of splitting it further is not worth it so we just hand it to `std::sort` and let that handle the base case

```cpp
typedef unsigned long long data_t;

void merge(
    data_t *left, int nl,
    data_t *right, int nr,
    data_t *out
) {
    int i=0, j=0, k=0;
    while(i < nl && j < nr) {
        if(left[i] < right[j]) out[k++] = left[i++];
        else out[k++] = right[j++];
    }
    if (i < nl) std::memcpy(out + k, left + i, (nl - i) * sizeof(data_t));
    else if (j < nr) std::memcpy(out + k, right + j, (nr - j) * sizeof(data_t));
}

void mergesort(data_t *src, int n, data_t *dst, int level) {
    if(n < 2) return;

    if(level <= MAX_LEVEL) {
        int mid = n / 2;
        mergesort(dst, mid, src, level + 1);
        mergesort(dst + mid, n - mid, src + mid, level + 1);
        merge(src, mid, src + mid, n - mid, dst);
    } else {
        std::sort(src, src + n);
        memcpy(dst, src, n * sizeof(data_t));
    }
}

void psort(int n, data_t *data) {
    data_t *buffer = (data_t *)aligned_alloc(64, ((n + 7) / 8) * 8 * sizeof(data_t));
    memcpy(buffer, data, n * sizeof(data_t));
    mergesort(buffer, n, data, 0);
    free(buffer);
}
```

Benchmarked this on my laptop (Apple M5, 10 cores, 4 performance + 6 efficiency, though this version doesn't touch the extra cores at all yet) with random uint64 arrays, best of 3 runs each:

```
n                    time (ms)
1,000,000              23.60
10,000,000            241.84
100,000,000          2585.10
```

Roughly linear with a bit of superlinear creep as n grows, which tracks, merge sort is O(n log n) and the log n factor starts to bite once n crosses into the hundreds of millions

## V2: Let The Recursion Fan Out

The two recursive calls in mergesort don't depend on each other at all, left half and right half can happen at the same time, so this is the obvious place to throw threads at it. Wrapped both calls in `#pragma omp task` inside a `taskgroup` so the parent waits for both children before it merges. The one thing that actually matters here is capping how deep this fan-out goes, spawning a task for a sub array of like 8 elements is pure overhead, so `MAX_LEVEL` is picked so the recursion produces roughly 2 leaf tasks per thread and then falls back to plain `std::sort` underneath that

```cpp
void mergesort(data_t *src, int n, data_t *dst, int level, const int MAX_LEVEL) {
    if(n < 2) return;

    if(level <= MAX_LEVEL) {
        int mid = n / 2;
        #pragma omp taskgroup
        {
            #pragma omp task
            mergesort(dst, mid, src, level + 1, MAX_LEVEL);
            #pragma omp task
            mergesort(dst + mid, n - mid, src + mid, level + 1, MAX_LEVEL);
        }
        merge(src, mid, src + mid, n - mid, dst);
    } else {
        std::sort(src, src + n);
        memcpy(dst, src, n * sizeof(data_t));
    }
}

void psort(int n, data_t *data) {
    data_t *buffer = (data_t *)aligned_alloc(64, ((n + 7) / 8) * 8 * sizeof(data_t));
    memcpy(buffer, data, n * sizeof(data_t));

    #pragma omp parallel
    #pragma omp single
    {
        int target_leaves = omp_get_max_threads() * 2;
        int MAX_LEVEL = (int)std::ceil(std::log2((double)target_leaves));
        mergesort(buffer, n, data, 0, MAX_LEVEL);
    }
    free(buffer);
}
```

```
n                    V1 (ms)     V2 (ms)     speedup
1,000,000              23.60       11.47       2.06x
10,000,000            241.84       82.52       2.93x
100,000,000          2585.10      760.88       3.40x
```

10 cores and best case is a 3.4x, not exactly the speedup you'd hope for. Three things eating into it: the M5 is 4 performance cores and 6 efficiency cores, so it's not really 10 equal cores, the top level merge (combining the final two n/2 halves back into one) is always single threaded no matter how many cores you have which caps the whole thing by Amdahl's law, and the smaller leaf tasks near the bottom of the recursion pay task creation overhead that doesn't show up when you just eyeball the algorithm on paper. Nice to actually see the theory show up as real numbers instead of just trusting it

## V3: Cutting The Branch (And Breaking Everything)

At this point the bottleneck inside each thread is just the merge loop, one comparison per element, `left[i] < right[j]`. On random data this branch is close to a coin flip so the CPU's branch predictor is wrong close to half the time, which stalls the pipeline constantly. The idea was to process the compare loop in fixed size chunks of 32 so the loop overhead amortizes and the compiler has a better shot at pipelining the repeated branch pattern instead of treating every single comparison as a one-off

```cpp
constexpr int BLOCK_SIZE = 32;

inline void merge(
    data_t *left, int nl,
    data_t *right, int nr,
    data_t *tmp, data_t *data
) {
    int i = 0, j = 0, k = 0;
    while (i < nl - BLOCK_SIZE && j < nr - BLOCK_SIZE) {
        for(int t=0; t<BLOCK_SIZE; t++) {
            if (left[i] <= right[j]) tmp[k++] = left[i++];
            else tmp[k++] = right[j++];
        }
    }
    while (i < nl) tmp[k++] = left[i++];
    while (j < nr) tmp[k++] = right[j++];
    std::memcpy(data, tmp, (nl + nr) * sizeof(data_t));
}
```

To actually find out how much of the merge cost was the branch itself versus just moving memory around, I wrote a second version of merge that skips the comparison entirely and always pulls from the left, purely to measure the floor:

```cpp
inline void merge2(
    data_t *left, int nl,
    data_t *right, int nr,
    data_t *tmp, data_t *data
) {
    int i = 0, j = 0, k = 0;
    while (i < nl - BLOCK_SIZE && j < nr - BLOCK_SIZE) {
        for(int t=0; t<BLOCK_SIZE; t++) { k++; i++; }
    }
    while (i < nl) tmp[k++] = left[i++];
    while (j < nr) tmp[k++] = right[j++];
    std::memcpy(data, tmp, (nl + nr) * sizeof(data_t));
}
```

Obviously this doesn't sort anything correctly since it's not comparing at all, that's the whole point, it's just there to answer "how fast would this be with the branch removed." Plugged it into the same parallel task structure as V2 and at n=10,000,000 the real branchy merge from V2 runs in 82.52ms while this fake branchless one runs in 48.90ms. So somewhere around 40% of the merge time was the mispredicted branch itself, the rest is just memory traffic you can't get rid of

Then I went back and swapped the real chunked comparison back in, expecting something between those two numbers. Got 110.28ms, slower than V2, and `std::is_sorted` came back false again. So there's a real bug in here somewhere, probably in how the blocking interacts with the parallel task recursion sharing the same tmp buffer across levels, and I never actually tracked it down. This version still sits broken in the so4 folder. V2 stayed the real answer

Worth saying plainly: I almost reported the merge2 number as a real speedup before running is_sorted on it. A fast wrong answer is worse than a slow right one, and it's very easy to only check the timer

## V4: Going Wide With AVX-512

The scalar merge loop only ever looks at one element per side per comparison. AVX-512 lets you compare 16 lanes at once, so instead of merging one element at a time you can merge whole tiles at a time

The approach has two phases. First, sort small 16 element tiles entirely inside a register using a fixed sequence of compare-and-swap stages, a bitonic sorting network, so a tile never touches memory until it's fully sorted:

```cpp
static inline void sort16_inregister(__m512i *v) {
    __m512i x = *v, y, min, max;
    y   = _mm512_shuffle_epi32(x, _MM_PERM_CDAB);
    min = _mm512_min_epi32(x, y);
    max = _mm512_max_epi32(x, y);
    x   = _mm512_blend_epi32(min, max, 0xAA);

    y   = _mm512_shuffle_epi32(x, _MM_PERM_BADC);
    min = _mm512_min_epi32(x, y);
    max = _mm512_max_epi32(x, y);
    x   = _mm512_blend_epi32(min, max, 0xCC);

    y   = _mm512_shuffle_epi32(x, _MM_PERM_4321);
    min = _mm512_min_epi32(x, y);
    max = _mm512_max_epi32(x, y);
    x   = _mm512_blend_epi32(min, max, 0xF0);

    y   = _mm512_shuffle_epi32(x, _MM_PERM_CDAB);
    min = _mm512_min_epi32(x, y);
    max = _mm512_max_epi32(x, y);
    *v  = _mm512_blend_epi32(min, max, 0xAA);
}
```

Second, merge sorted runs bottom up, doubling the run length each pass like a normal iterative merge sort, but merging 16 elements from each side at a time instead of one. Compare both 16-lane chunks to get a mask of which lane came from which side, popcount that mask to know exactly how many elements the left side contributed this round, and use a masked compress-store to pack just those lanes contiguously into the output, all in one instruction instead of 16 branchy comparisons:

```cpp
static void merge_avx512(const int *A, const int *B, int *OUT, size_t N) {
    size_t i = 0, j = 0, k = 0;
    while (i + 16 <= N && j + 16 <= N) {
        __m512i bufA = _mm512_loadu_si512((__m512i*)(A + i));
        __m512i bufB = _mm512_loadu_si512((__m512i*)(B + j));
        __mmask16 m = _mm512_cmple_epi32_mask(bufA, bufB);
        size_t na = _popcnt32(m);
        _mm512_mask_compressstoreu_epi32(OUT + k,      m,  bufA);
        _mm512_mask_compressstoreu_epi32(OUT + k + na, ~m, bufB);
        i += na; j += 16 - na; k += 16;
    }
    while (i < N && j < N) OUT[k++] = (A[i] < B[j] ? A[i++] : B[j++]);
    while (i < N) OUT[k++] = A[i++];
    while (j < N) OUT[k++] = B[j++];
}

void merge_sort_avx512_omp(int *data, size_t N) {
    const size_t TILE = 16;
    int *buffer = (int*)aligned_alloc(64, N * sizeof(int));

    #pragma omp parallel for schedule(static)
    for (size_t i = 0; i + TILE <= N; i += TILE) {
        __m512i v = _mm512_loadu_si512((__m512i*)(data + i));
        sort16_inregister(&v);
        _mm512_storeu_si512((__m512i*)(data + i), v);
    }

    for (size_t width = TILE; width < N; width <<= 1) {
        #pragma omp parallel for schedule(dynamic)
        for (size_t start = 0; start < N; start += 2 * width) {
            size_t mid = start + width;
            if (mid >= N) continue;
            size_t end = std::min(mid + width, N);
            merge_avx512(data + start, data + mid, buffer + start, mid - start);
            memcpy(data + start, buffer + start, (end - start) * sizeof(int));
        }
    }
    free(buffer);
}
```
