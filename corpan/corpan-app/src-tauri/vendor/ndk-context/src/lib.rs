//! Corpan vendored fork of `ndk-context` 0.1.1.
//!
//! The only divergence from upstream is that `initialize_android_context` and
//! `release_android_context` no longer `assert!` on the previous slot state.
//!
//! Upstream aborts the process if the slot is non-empty on init (or empty on
//! release). On Android this happens whenever the Activity is recreated while
//! the process survives — e.g. a config change not absorbed by `configChanges`,
//! "Don't keep activities" being enabled, or the system reclaiming the Activity
//! but not the process. Tao calls `WryActivity.onCreate` -> `ndk_glue::create`
//! -> `initialize_android_context` again, and the process dies with
//! "assertion failed: previous.is_none()".
//!
//! The jobject stored here is a raw pointer; tao owns the matching JNI global
//! reference and releases it in its own destroy path, so replacing the slot
//! does not leak.
use std::ffi::c_void;

static mut ANDROID_CONTEXT: Option<AndroidContext> = None;

#[derive(Clone, Copy, Debug)]
pub struct AndroidContext {
    java_vm: *mut c_void,
    context_jobject: *mut c_void,
}

impl AndroidContext {
    pub fn vm(self) -> *mut c_void {
        self.java_vm
    }

    pub fn context(self) -> *mut c_void {
        self.context_jobject
    }
}

pub fn android_context() -> AndroidContext {
    unsafe { ANDROID_CONTEXT.expect("android context was not initialized") }
}

/// # Safety
/// The pointers must be valid for the lifetime of the stored context.
pub unsafe fn initialize_android_context(java_vm: *mut c_void, context_jobject: *mut c_void) {
    let _ = ANDROID_CONTEXT.replace(AndroidContext {
        java_vm,
        context_jobject,
    });
}

/// # Safety
/// Must only be called after `initialize_android_context()`.
pub unsafe fn release_android_context() {
    let _ = ANDROID_CONTEXT.take();
}
