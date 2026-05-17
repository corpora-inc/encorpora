# Android JNI build for tauri-plugin-stt.
#
# Produces a single shared library `libwhisper-jni.so` that links
# against whisper.cpp statically. Invoked by Gradle's
# externalNativeBuild — see ../../../build.gradle.kts.
#
# Phase 0: CPU-only build. GPU backends (Vulkan / OpenCL / NNAPI) are
# disabled to keep the path simple; we can revisit once the basic
# load + transcribe path is verified on device.

cmake_minimum_required(VERSION 3.22)
project(whisper-jni LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Force -O3 EVEN IN DEBUG BUILDS. The AGP default debug CMake config
# uses -O0, which is fine for our JNI shim but catastrophic for the
# whisper.cpp + ggml inner loops — observed 50× realtime on Whisper
# Small with 8 threads at -O0 vs the expected 1-2× realtime. We're
# not stepping through whisper internals during dev so the debug
# symbols vs speed trade isn't close.
add_compile_options(-O3)
add_compile_options(-DNDEBUG)

# Emit DWARF debug info alongside -O3 so AGP's `debugSymbolLevel =
# "FULL"` (set in the main app's gen/android build.gradle.kts) has
# something to extract into the AAB's `native-debug-symbols.zip`.
# Without `-g`, Play Console gets a symbol-less AAB and crash
# backtraces in whisper.cpp / ggml come through as raw hex offsets
# — verified empirically: the 0.12.6 first upload triggered the
# "no debug symbols" warning specifically because of this gap.
# The .so files that ship to user devices are still stripped by
# the NDK before packaging; only Play Console gets the unstripped
# symbols, so there's no user-facing size or perf cost. Keeping
# frame pointers makes the resulting backtraces actually walkable
# under -O3 (clang otherwise omits them on arm64).
add_compile_options(-g)
add_compile_options(-fno-omit-frame-pointer)

# whisper.cpp build flags — turn off everything we don't need so the
# build is fast and the .so is small.
set(BUILD_SHARED_LIBS  OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_TESTS    OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_SERVER   OFF CACHE BOOL "" FORCE)
set(GGML_METAL             OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP            OFF CACHE BOOL "" FORCE)
set(GGML_OPENCL            OFF CACHE BOOL "" FORCE)
set(GGML_VULKAN            OFF CACHE BOOL "" FORCE)
set(GGML_BLAS              OFF CACHE BOOL "" FORCE)
set(GGML_CCACHE            OFF CACHE BOOL "" FORCE)

# Match whisper.cpp's own `examples/whisper.android/lib/src/main/jni/whisper/CMakeLists.txt`
# config for arm64-v8a: target ARMv8.2-A with two optional extensions:
#
#   +fp16     — hardware fp16 NEON ops. Without this the compiler
#               defaults to armv8-a (no FP16) and ggml's fp16 vec_dot
#               path emits NEON intrinsics that don't have a real
#               instruction on the target — the root cause of the
#               SIGSEGV in `ggml_vec_dot_f16` we saw on Snapdragon 8
#               Elite during early Phase 1. With `+fp16` the kernels
#               compile to the real fp16 NEON ops and run fast + stable
#               across all cores.
#
#   +dotprod  — int8 dot-product (UDOT/SDOT) NEON ops. Gates the
#               dotprod-accelerated `vec_dot_q4_0_q8_0`,
#               `vec_dot_q5_0_q8_0`, `vec_dot_q8_0_q8_0` kernels in
#               `ggml-cpu/arch/arm/quants.c` behind
#               `__ARM_FEATURE_DOTPROD`. Without the flag those
#               kernels #ifdef out and the scalar fallback runs ~2-4×
#               slower per matmul. ARMv8.2-A extension, supported on
#               every phone our `+fp16` target already covers
#               (Cortex-A75+, all Snapdragon 8-series, etc. — ~2018+).
#
# Pair this with reading the high-performance CPU count on the Kotlin
# side (see `WhisperCpuConfig.kt`) and passing it as `n_threads` so
# workers stay pinned to perf cores. Workers spread across perf +
# efficiency cores are the *other* part of the same crash family —
# torn reads from memory that's been updated by a different cluster's
# cache.
#
# Not enabled here: `+i8mm` (ARMv8.6-A int8 matrix multiply). Bigger
# perf win for quantized models but only on Snapdragon 8 Gen 1+
# (~2022 phones); enabling it in a single-variant build would SIGILL
# on older devices. Defer until we either bump minSdk or wire ggml's
# multi-variant runtime selection.
if(ANDROID_ABI STREQUAL "arm64-v8a")
    add_definitions(-DGGML_USE_CPU_AARCH64)
    add_compile_options(-march=armv8.2-a+fp16+dotprod)
endif()

# Pull in whisper.cpp source. Vendored under whisper.cpp/, gitignored.
add_subdirectory(whisper.cpp)

# JNI shim — the only file we own here.
add_library(whisper-jni SHARED whisper_jni.cpp)

# 16 KB page size compatibility — Play Store requirement since
# Nov 1 2025; hard enforcement May 1 2026. Mirrors the rustflags
# block in src-tauri/.cargo/config.toml (commit 2c35528c, 0.7.8)
# that aligns libcorpan_lib.so across all four ABIs. NDK 28's
# CMake builds DO NOT enable this by default — must be explicit.
# Without these flags the produced .so is 4 KB-page-aligned and
# falls into bionic's compatibility shim on Pixel 9 / Android 15+
# 16 KB hardware (15-30% slower app startup, ~5% more power) and
# trips Play Console's "does not support 16 KB" upload warning.
# Verify post-build:
#   readelf --segments .../arm64-v8a/libwhisper-jni.so | grep LOAD
# should show alignment 0x4000 (16 KB), not 0x1000 (4 KB).
target_link_options(whisper-jni PRIVATE
    "-Wl,-z,max-page-size=16384"
    "-Wl,-z,common-page-size=16384"
)

target_include_directories(whisper-jni PRIVATE
    whisper.cpp/include
    whisper.cpp/ggml/include
)

target_link_libraries(whisper-jni
    PRIVATE
    whisper        # static lib from whisper.cpp's CMakeLists
    log            # __android_log_print
)
