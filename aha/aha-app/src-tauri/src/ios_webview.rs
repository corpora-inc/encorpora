//! iOS WKWebView setup for the studio.
//!
//! WKWebView pads the page for the safe area on its own; the studio already applies
//! `env(safe-area-inset-*)`, so that automatic inset only left an unpainted band under the page.
//! It is turned off for the whole app.
//!
//! The focus loop is a fixed full-screen stage that moves only its answer dock when the software
//! keyboard opens. WKWebView would also scroll its own scroll view to reveal the focused field
//! (even with scrolling disabled), which pushed the answer to the top of the screen above a blank
//! gap. While the page asks for it (`pin_page_scroll`), the scroll view is held at its resting
//! offset. Other screens scroll as a document and keep WebKit's behaviour.

use std::cell::RefCell;
use std::ffi::c_void;

use objc2::rc::Retained;
use objc2::runtime::{AnyObject, NSObject};
use objc2::{MainThreadMarker, MainThreadOnly, define_class, msg_send};
use objc2_core_foundation::CGPoint;
use objc2_foundation::{
    NSDictionary, NSKeyValueChangeKey, NSKeyValueObservingOptions,
    NSObjectNSKeyValueObserverRegistration, NSString, ns_string,
};
use objc2_ui_kit::{UIScrollView, UIScrollViewContentInsetAdjustmentBehavior};
use tauri::{Manager, Runtime};

define_class!(
    /// Holds a pinned scroll view at its resting offset. contentOffset changes are KVO-observable,
    /// and the reset happens synchronously, before anything is drawn at the moved offset.
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "AhaScrollPin"]
    #[ivars = ()]
    struct ScrollPin;

    impl ScrollPin {
        #[unsafe(method(observeValueForKeyPath:ofObject:change:context:))]
        fn observe_value(
            &self,
            _key_path: Option<&NSString>,
            object: Option<&AnyObject>,
            _change: Option<&NSDictionary<NSKeyValueChangeKey, AnyObject>>,
            _context: *mut c_void,
        ) {
            if let Some(scroll_view) = object.and_then(|o| o.downcast_ref::<UIScrollView>()) {
                hold_at_rest(scroll_view);
            }
        }
    }
);

impl ScrollPin {
    fn new(mtm: MainThreadMarker) -> Retained<Self> {
        let this = Self::alloc(mtm).set_ivars(());
        unsafe { msg_send![super(this), init] }
    }
}

thread_local! {
    static PINNED: RefCell<Option<(Retained<ScrollPin>, Retained<UIScrollView>)>> =
        const { RefCell::new(None) };
}

thread_local! {
    /// Set while `hold_at_rest` writes the offset: the write re-enters the KVO callback.
    static HOLDING: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

fn hold_at_rest(scroll_view: &UIScrollView) {
    if HOLDING.get() {
        return;
    }
    let inset = scroll_view.adjustedContentInset();
    let rest = CGPoint::new(-inset.left, -inset.top);
    let now = scroll_view.contentOffset();
    // Half a point of tolerance: UIKit may round the offset it stores to device pixels.
    if (now.x - rest.x).abs() > 0.5 || (now.y - rest.y).abs() > 0.5 {
        HOLDING.set(true);
        scroll_view.setContentOffset(rest);
        HOLDING.set(false);
    }
}

fn scroll_view_of(webview: &tauri::webview::PlatformWebview) -> Option<Retained<UIScrollView>> {
    let wk_webview = webview.inner().cast::<AnyObject>();
    if wk_webview.is_null() {
        return None;
    }
    // SAFETY: on iOS `inner()` is the live WKWebView, and `scrollView` is its documented
    // UIScrollView property. Callers run on the main thread (inside `with_webview`).
    Some(unsafe { msg_send![&*wk_webview, scrollView] })
}

/// App-wide: no automatic safe-area content inset (the page applies the insets itself).
pub fn configure<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };
    window.with_webview(|webview| {
        if let Some(scroll_view) = scroll_view_of(&webview) {
            scroll_view.setBounces(false);
            scroll_view.setContentInsetAdjustmentBehavior(
                UIScrollViewContentInsetAdjustmentBehavior::Never,
            );
        }
    })
}

/// Pins (or releases) the page scroll while the focus loop is on screen. A page (re)load releases
/// it too (`lib.rs`): a reload after iOS ends the web content process starts on the home screen,
/// whose cleanup would otherwise never run.
pub fn pin<R: Runtime>(webview: &tauri::Webview<R>, pinned: bool) -> tauri::Result<()> {
    webview.with_webview(move |webview| {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let Some(scroll_view) = scroll_view_of(&webview) else {
            return;
        };
        PINNED.with_borrow_mut(|slot| {
            if pinned {
                if slot.is_none() {
                    let observer = ScrollPin::new(mtm);
                    // SAFETY: the observer is retained in `slot` until it is removed below, and
                    // `contentOffset` is a KVO-observable UIScrollView property.
                    unsafe {
                        scroll_view.addObserver_forKeyPath_options_context(
                            &observer,
                            ns_string!("contentOffset"),
                            NSKeyValueObservingOptions::New,
                            std::ptr::null_mut(),
                        );
                    }
                    *slot = Some((observer, scroll_view.clone()));
                }
                scroll_view.setScrollEnabled(false);
                hold_at_rest(&scroll_view);
            } else if let Some((observer, observed)) = slot.take() {
                // SAFETY: removes exactly the registration added above, on the same object.
                unsafe {
                    observed.removeObserver_forKeyPath(&observer, ns_string!("contentOffset"))
                };
                observed.setScrollEnabled(true);
            }
        });
    })
}
