import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open dialogs, innermost last. Only the top one handles Escape and Tab.
const stack = [];

// Makes everything outside the dialog inert (no focus, clicks or screen-reader access):
// the siblings of each ancestor from the dialog's container up to <body>. The dialog's
// own siblings are left alone so its backdrop stays clickable. Returns an undo function.
function isolate(node) {
  const changed = [];
  for (let el = node.parentElement; el && el !== document.body; el = el.parentElement) {
    for (const sib of el.parentElement?.children || []) {
      if (sib === el || sib.hasAttribute("inert") || sib.tagName === "SCRIPT") continue;
      sib.setAttribute("inert", "");
      changed.push(sib);
    }
  }
  return () => changed.forEach((el) => el.removeAttribute("inert"));
}

// Shared modal behaviour: background made inert, initial focus, Tab kept inside,
// Escape closes, background scroll locked, focus returned to the opener on close.
// Attach the returned ref to the dialog element (the one with role="dialog"); keep the
// dialog and its backdrop together inside one wrapper element.
export default function useDialog(isOpen, onClose) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const node = ref.current;
    if (!node) return;

    const opener = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    stack.push(node);
    const restoreBackground = isolate(node);

    if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");
    (node.querySelector("[data-autofocus]") || node.querySelector(FOCUSABLE) || node).focus();

    const onKeyDown = (e) => {
      if (stack[stack.length - 1] !== node) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      stack.splice(stack.indexOf(node), 1);
      restoreBackground();
      document.body.style.overflow = prevOverflow;
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
    };
  }, [isOpen]);

  return ref;
}
