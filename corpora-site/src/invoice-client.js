(() => {
  const dialog = document.querySelector("[data-invoice-dialog]");
  if (!(dialog instanceof HTMLDialogElement)) return;
  const frame = dialog.querySelector("iframe");
  let opener;
  document.querySelectorAll("[data-invoice-form='open']").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      if (!frame.getAttribute("src")) frame.src = frame.dataset.invoiceSrc;
      dialog.showModal();
    });
  });
  dialog.querySelector("[data-invoice-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => opener?.focus());
})();
