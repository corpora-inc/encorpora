// JNI bridge: Kotlin → C++ → llama.cpp.
//
// SCAFFOLD ONLY — the polish machine fills these in once llama.cpp is vendored.

#include <jni.h>
#include <string>
#include <android/log.h>

#define LOG_TAG "corpan-llm"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

// #include "llama.h"  // uncomment when llama.cpp is vendored

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_corpan_llm_LlmNative_load(JNIEnv* env, jobject /*thiz*/, jstring ggufPath, jint nGpuLayers, jint nCtx) {
    const char* path = env->GetStringUTFChars(ggufPath, nullptr);
    LOGI("load: %s, gpu_layers=%d, n_ctx=%d", path, nGpuLayers, nCtx);
    env->ReleaseStringUTFChars(ggufPath, path);

    // TODO: llama_model_default_params, llama_load_model_from_file, etc.
    return JNI_TRUE;
}

JNIEXPORT void JNICALL
Java_com_corpan_llm_LlmNative_unload(JNIEnv* /*env*/, jobject /*thiz*/) {
    LOGI("unload");
    // TODO: llama_free, llama_free_model
}

JNIEXPORT jstring JNICALL
Java_com_corpan_llm_LlmNative_chatStub(JNIEnv* env, jobject /*thiz*/, jstring lastUser) {
    const char* text = env->GetStringUTFChars(lastUser, nullptr);
    std::string result = std::string("[stub] ") + text;
    env->ReleaseStringUTFChars(lastUser, text);
    return env->NewStringUTF(result.c_str());
}

}  // extern "C"
