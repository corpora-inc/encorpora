# Install script for directory: /Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml

# Set the install prefix
if(NOT DEFINED CMAKE_INSTALL_PREFIX)
  set(CMAKE_INSTALL_PREFIX "/usr/local")
endif()
string(REGEX REPLACE "/$" "" CMAKE_INSTALL_PREFIX "${CMAKE_INSTALL_PREFIX}")

# Set the install configuration name.
if(NOT DEFINED CMAKE_INSTALL_CONFIG_NAME)
  if(BUILD_TYPE)
    string(REGEX REPLACE "^[^A-Za-z0-9_]+" ""
           CMAKE_INSTALL_CONFIG_NAME "${BUILD_TYPE}")
  else()
    set(CMAKE_INSTALL_CONFIG_NAME "Debug")
  endif()
  message(STATUS "Install configuration: \"${CMAKE_INSTALL_CONFIG_NAME}\"")
endif()

# Set the component getting installed.
if(NOT CMAKE_INSTALL_COMPONENT)
  if(COMPONENT)
    message(STATUS "Install component: \"${COMPONENT}\"")
    set(CMAKE_INSTALL_COMPONENT "${COMPONENT}")
  else()
    set(CMAKE_INSTALL_COMPONENT)
  endif()
endif()

# Install shared libraries without execute permission?
if(NOT DEFINED CMAKE_INSTALL_SO_NO_EXE)
  set(CMAKE_INSTALL_SO_NO_EXE "0")
endif()

# Is this installation the result of a crosscompile?
if(NOT DEFINED CMAKE_CROSSCOMPILING)
  set(CMAKE_CROSSCOMPILING "TRUE")
endif()

# Set default install directory permissions.
if(NOT DEFINED CMAKE_OBJDUMP)
  set(CMAKE_OBJDUMP "/Users/skyl/Android/ndk/27.0.12077973/toolchains/llvm/prebuilt/darwin-x86_64/bin/llvm-objdump")
endif()

if(NOT CMAKE_INSTALL_LOCAL_ONLY)
  # Include the install script for the subdirectory.
  include("/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/.cxx/Debug/14c5g6y6/arm64-v8a/whisper.cpp/ggml/src/cmake_install.cmake")
endif()

if("x${CMAKE_INSTALL_COMPONENT}x" STREQUAL "xUnspecifiedx" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib" TYPE STATIC_LIBRARY FILES "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/.cxx/Debug/14c5g6y6/arm64-v8a/whisper.cpp/ggml/src/libggml.a")
endif()

if("x${CMAKE_INSTALL_COMPONENT}x" STREQUAL "xUnspecifiedx" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/include" TYPE FILE FILES
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-cpu.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-alloc.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-backend.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-blas.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-cann.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-cpp.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-cuda.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-opt.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-metal.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-rpc.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-virtgpu.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-sycl.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-vulkan.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-webgpu.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-zendnn.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/ggml-openvino.h"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/src/main/cpp/whisper.cpp/ggml/include/gguf.h"
    )
endif()

if("x${CMAKE_INSTALL_COMPONENT}x" STREQUAL "xUnspecifiedx" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib" TYPE STATIC_LIBRARY FILES "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/.cxx/Debug/14c5g6y6/arm64-v8a/whisper.cpp/ggml/src/libggml-base.a")
endif()

if("x${CMAKE_INSTALL_COMPONENT}x" STREQUAL "xUnspecifiedx" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/ggml" TYPE FILE FILES
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/.cxx/Debug/14c5g6y6/arm64-v8a/whisper.cpp/ggml/ggml-config.cmake"
    "/Users/skyl/Code/corpora/encorpora/corpan/plugins/tauri-plugin-stt/android/.cxx/Debug/14c5g6y6/arm64-v8a/whisper.cpp/ggml/ggml-version.cmake"
    )
endif()

