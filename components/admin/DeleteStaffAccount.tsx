"use client";

import { useState } from "react";
import { deleteStaffAccountAction } from "@/lib/staff-account-actions";

export function DeleteStaffAccount({
  id,
  email,
  returnTo,
  labels,
}: {
  id: string;
  email: string;
  returnTo: string;
  labels: {
    delete: string;
    warning: string;
    confirm: string;
    cancel: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const matches = confirmation.trim().toLowerCase() === email.toLowerCase();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[42px] rounded-[4px] border border-red-300 px-[13px] font-sans text-[12px] tracking-[.08em] text-red-800 uppercase hover:bg-red-50"
      >
        {labels.delete}
      </button>
    );
  }

  return (
    <form
      action={deleteStaffAccountAction}
      className="w-full rounded-[6px] border border-red-200 bg-red-50/60 p-[12px]"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <p className="font-sans text-[13px] text-red-900">{labels.warning}</p>
      <label className="mt-[9px] block font-sans text-[12px] text-red-900">
        {labels.confirm}
        <input
          name="confirmationEmail"
          type="email"
          autoComplete="off"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={email}
          className="mt-[5px] min-h-[44px] w-full rounded-[4px] border border-red-300 bg-page px-[11px] font-sans text-[14px] text-ink"
          required
        />
      </label>
      <div className="mt-[9px] flex flex-wrap gap-[8px]">
        <button
          type="submit"
          disabled={!matches}
          className="min-h-[42px] rounded-[4px] bg-red-800 px-[13px] font-sans text-[12px] tracking-[.08em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-40"
        >
          {labels.delete}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirmation("");
          }}
          className="min-h-[42px] rounded-[4px] border border-line-btn px-[13px] font-sans text-[12px] tracking-[.08em] uppercase hover:bg-btn-fill"
        >
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}
