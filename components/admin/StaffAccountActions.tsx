"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { DotsThree } from "@phosphor-icons/react";
import { AdminPasswordField } from "@/components/admin/AdminPasswordField";
import {
  deleteStaffAccountAction,
  resetStaffPasswordAction,
  revokeStaffSessionsAction,
  setStaffStatusAction,
} from "@/lib/staff-account-actions";

type Labels = {
  actions: string;
  reset: string;
  resetSubmit: string;
  sessions: string;
  status: string;
  audit: string;
  delete: string;
  deleteWarning: string;
  deleteConfirm: string;
  cancel: string;
  showPassword: string;
  hidePassword: string;
};

export function StaffAccountActions({
  id,
  email,
  returnTo,
  deleteReturnTo = returnTo,
  auditHref,
  nextStatus,
  labels,
  variant = "menu",
}: {
  id: string;
  email: string;
  returnTo: string;
  deleteReturnTo?: string;
  auditHref?: string;
  nextStatus: "ACTIVE" | "DISABLED";
  labels: Labels;
  variant?: "menu" | "panel";
}) {
  const menuId = useId();
  const dialogTitleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"reset" | "delete" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const focusTrigger = useCallback(function focusTrigger() {
    window.requestAnimationFrame(() =>
      (dialogTriggerRef.current ?? triggerRef.current)?.focus(),
    );
  }, []);

  const closeMenu = useCallback(
    function closeMenu(returnFocus = true) {
      setOpen(false);
      if (returnFocus) focusTrigger();
    },
    [focusTrigger],
  );

  const closeDialog = useCallback(
    function closeDialog() {
      setDialog(null);
      setConfirmation("");
      focusTrigger();
    },
    [focusTrigger],
  );

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    if (!trigger) return;
    const menuWidth = 260;
    const estimatedHeight = 264;
    const top =
      trigger.bottom + estimatedHeight <= window.innerHeight - 8
        ? trigger.bottom + 6
        : Math.max(8, trigger.top - estimatedHeight - 6);
    setPosition({
      top,
      left: Math.max(
        8,
        Math.min(trigger.right - menuWidth, window.innerWidth - menuWidth - 8),
      ),
    });
    window.requestAnimationFrame(() => itemRefs.current[0]?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: globalThis.MouseEvent) {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [closeMenu, open]);

  useEffect(() => {
    if (!dialog) return;
    dialogRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeDialog, dialog]);

  function openMenuAt(index: number) {
    setOpen(true);
    window.requestAnimationFrame(() => itemRefs.current[index]?.focus());
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openMenuAt(event.key === "ArrowUp" ? 4 : 0);
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = itemRefs.current.filter(Boolean) as HTMLElement[];
    const current = Math.max(
      0,
      items.indexOf(document.activeElement as HTMLElement),
    );
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length;
    items[next]?.focus();
  }

  function showDialog(next: "reset" | "delete", returnFocusTo?: HTMLElement) {
    dialogTriggerRef.current = returnFocusTo ?? triggerRef.current;
    setOpen(false);
    setDialog(next);
  }

  function dismissFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) closeDialog();
  }

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={labels.actions}
          onKeyDown={onMenuKeyDown}
          style={{ top: position.top, left: position.left }}
          className="fixed z-[220] w-[260px] rounded-[7px] border border-line-card bg-card p-[5px] shadow-card"
        >
          <button
            ref={(node) => {
              itemRefs.current[0] = node;
            }}
            role="menuitem"
            type="button"
            onClick={() => showDialog("reset")}
            className="flex min-h-11 w-full items-center rounded-[4px] px-3 text-left font-sans text-[13px] hover:bg-btn-fill focus-visible:bg-btn-fill focus-visible:outline-none"
          >
            {labels.reset}
          </button>
          <form action={revokeStaffSessionsAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button
              ref={(node) => {
                itemRefs.current[1] = node;
              }}
              role="menuitem"
              className="flex min-h-11 w-full items-center rounded-[4px] px-3 text-left font-sans text-[13px] hover:bg-btn-fill focus-visible:bg-btn-fill focus-visible:outline-none"
            >
              {labels.sessions}
            </button>
          </form>
          <form action={setStaffStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="status" value={nextStatus} />
            <button
              ref={(node) => {
                itemRefs.current[2] = node;
              }}
              role="menuitem"
              className="flex min-h-11 w-full items-center rounded-[4px] px-3 text-left font-sans text-[13px] hover:bg-btn-fill focus-visible:bg-btn-fill focus-visible:outline-none"
            >
              {labels.status}
            </button>
          </form>
          {auditHref ? (
            <a
              ref={(node) => {
                itemRefs.current[3] = node;
              }}
              role="menuitem"
              href={auditHref}
              className="flex min-h-11 w-full items-center rounded-[4px] px-3 font-sans text-[13px] hover:bg-btn-fill focus-visible:bg-btn-fill focus-visible:outline-none"
            >
              {labels.audit}
            </a>
          ) : null}
          <button
            ref={(node) => {
              itemRefs.current[4] = node;
            }}
            role="menuitem"
            type="button"
            onClick={() => showDialog("delete")}
            className="flex min-h-11 w-full items-center rounded-[4px] px-3 text-left font-sans text-[13px] text-red-800 hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none"
          >
            {labels.delete}
          </button>
        </div>,
        document.body,
      )
    : null;

  const modal = dialog
    ? createPortal(
        <div
          role="presentation"
          onMouseDown={dismissFromBackdrop}
          className="fixed inset-0 z-[230] grid place-items-center bg-ink/35 p-4"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="w-full max-w-[480px] rounded-[8px] border border-line-card bg-card p-[20px] shadow-card"
          >
            <h3
              id={dialogTitleId}
              className="font-display text-[25px] font-medium"
            >
              {dialog === "reset" ? labels.reset : labels.delete}
            </h3>
            {dialog === "reset" ? (
              <form action={resetStaffPasswordAction} className="mt-4">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <AdminPasswordField
                  name="temporaryPassword"
                  autoComplete="new-password"
                  showLabel={labels.showPassword}
                  hideLabel={labels.hidePassword}
                  placeholder={labels.reset}
                  className="min-h-11 w-full rounded-[4px] border border-line-btn bg-page px-[11px] font-sans text-[14px]"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="min-h-11 rounded-[4px] bg-accent px-[13px] font-sans text-[12px] tracking-[.08em] text-page uppercase">
                    {labels.resetSubmit}
                  </button>
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="min-h-11 rounded-[4px] border border-line-btn px-[13px] font-sans text-[12px] tracking-[.08em] uppercase hover:bg-btn-fill"
                  >
                    {labels.cancel}
                  </button>
                </div>
              </form>
            ) : (
              <form action={deleteStaffAccountAction} className="mt-4">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="returnTo" value={deleteReturnTo} />
                <p className="font-sans text-[13px] text-red-900">
                  {labels.deleteWarning}
                </p>
                <label className="mt-3 block font-sans text-[12px] text-red-900">
                  {labels.deleteConfirm}
                  <input
                    name="confirmationEmail"
                    type="email"
                    autoComplete="off"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder={email}
                    className="mt-[5px] min-h-11 w-full rounded-[4px] border border-red-300 bg-page px-[11px] font-sans text-[14px] text-ink"
                    required
                  />
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    disabled={
                      confirmation.trim().toLowerCase() !== email.toLowerCase()
                    }
                    className="min-h-11 rounded-[4px] bg-red-800 px-[13px] font-sans text-[12px] tracking-[.08em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {labels.delete}
                  </button>
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="min-h-11 rounded-[4px] border border-line-btn px-[13px] font-sans text-[12px] tracking-[.08em] uppercase hover:bg-btn-fill"
                  >
                    {labels.cancel}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {variant === "panel" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(event) => showDialog("reset", event.currentTarget)}
            className="min-h-11 rounded-[4px] border border-line-btn px-[13px] font-sans text-[12px] tracking-[.06em] uppercase hover:bg-btn-fill focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {labels.reset}
          </button>
          <form action={revokeStaffSessionsAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button className="min-h-11 rounded-[4px] border border-line-btn px-[13px] font-sans text-[12px] tracking-[.06em] uppercase hover:bg-btn-fill focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
              {labels.sessions}
            </button>
          </form>
          <form action={setStaffStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="status" value={nextStatus} />
            <button className="min-h-11 rounded-[4px] border border-line-btn px-[13px] font-sans text-[12px] tracking-[.06em] uppercase hover:bg-btn-fill focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
              {labels.status}
            </button>
          </form>
          {auditHref ? (
            <a
              href={auditHref}
              className="inline-flex min-h-11 items-center rounded-[4px] border border-line-btn px-[13px] font-sans text-[12px] tracking-[.06em] uppercase hover:bg-btn-fill focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              {labels.audit}
            </a>
          ) : null}
          <button
            type="button"
            onClick={(event) => showDialog("delete", event.currentTarget)}
            className="min-h-11 rounded-[4px] border border-red-300 px-[13px] font-sans text-[12px] tracking-[.06em] text-red-800 uppercase hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:outline-none"
          >
            {labels.delete}
          </button>
        </div>
      ) : (
        <>
          <button
            ref={triggerRef}
            type="button"
            aria-label={labels.actions}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            title={labels.actions}
            onClick={() => setOpen((current) => !current)}
            onKeyDown={onTriggerKeyDown}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[4px] border border-line-btn text-ink hover:bg-btn-fill focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <DotsThree size={22} weight="bold" aria-hidden="true" />
          </button>
          {menu}
        </>
      )}
      {modal}
    </>
  );
}
