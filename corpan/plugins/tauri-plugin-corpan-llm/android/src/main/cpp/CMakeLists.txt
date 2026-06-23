# SCAFFOLD ONLY — polish machine vendors llama.cpp at the relative path
# below and wires up GGML_VULKAN.
#
# Steps for the polish machine:
#   1. cd plugins/tauri-plugin-corpan-llm/vendor && git clone https://github.com/ggml-org/llama.cpp
#      (and pin a commit; vendored under android/src/main/cpp/llama.cpp/)
#   2. Confirm the Vulkan SDK + Android NDK are available
#   3. Build with `./gradlew assembleRelease`

cmake_minimum_required(VERSION 3.22)
project(corpan_llm)

# Vendored llama.cpp
# add_subdirectory(llama.cpp)

add_library(
    corpan_llm
    SHARED
    bridge.cpp
)

# target_link_libraries(corpan_llm llama vulkan log)
target_link_libraries(corpan_llm log)
