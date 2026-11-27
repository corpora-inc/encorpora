// Apply the saved theme before first paint so there is no flash.
try {
  var t = JSON.parse(localStorage.getItem("crane.settings") || "{}").state;
  if (t && (t.theme === "light" || t.theme === "dark")) document.documentElement.dataset.theme = t.theme;
} catch (e) {
  console.error("theme boot", e);
}
