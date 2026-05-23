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
use std::ptr::addr_of_mut;

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
    // SAFETY: read-only access via a raw pointer dereference. Android
    // JNI calls into this from the main thread; we don't synchronize
    // against re-initialization, matching upstream ndk-context's
    // contract.
    unsafe {
        (*addr_of_mut!(ANDROID_CONTEXT)).expect("android context was not initialized")
    }
}

/// # Safety
/// The pointers must be valid for the lifetime of the stored context.
pub unsafe fn initialize_android_context(java_vm: *mut c_void, context_jobject: *mut c_void) {
    // Use a raw pointer (addr_of_mut!) to satisfy the Rust 2024
    // `static_mut_refs` lint without changing semantics — we still
    // single-threaded-overwrite the slot just like upstream
    // ndk-context, just via a raw write instead of `Option::replace`
    // (which would implicitly take `&mut` on the static).
    let slot = addr_of_mut!(ANDROID_CONTEXT);
    (*slot) = Some(AndroidContext {
        java_vm,
        context_jobject,
    });
}

/// # Safety
/// Must only be called after `initialize_android_context()`.
pub unsafe fn release_android_context() {
    let slot = addr_of_mut!(ANDROID_CONTEXT);
    (*slot) = None;
}
