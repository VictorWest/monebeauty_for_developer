"use client";

import { useState } from "react";
import {
  EnvelopeSimple,
  PaperPlaneTilt,
  ChatText,
} from "@phosphor-icons/react";
import { sendAdminCommunicationAction } from "@/lib/admin-actions";
import { smsSegments } from "@/lib/sms/segments";

export function CommunicationComposer({
  entity,
  id,
  returnTo,
  email,
  phone,
  labels,
}: {
  entity: "Order" | "Appointment";
  id: string;
  returnTo: string;
  email: string;
  phone: string | null;
  labels: {
    title: string;
    email: string;
    sms: string;
    to: string;
    subject: string;
    message: string;
    send: string;
    segments: string;
    transactional: string;
  };
}) {
  const [channel, setChannel] = useState<"EMAIL" | "SMS">("EMAIL");
  const [body, setBody] = useState("");
  const sms = smsSegments(body);
  const recipient = channel === "EMAIL" ? email : phone;

  return (
    <section className="rounded-[var(--radius)] border border-line-card bg-card p-[clamp(18px,3vw,28px)]">
      <h2 className="font-display text-[26px] font-medium text-ink">
        {labels.title}
      </h2>
      <p className="mt-[6px] font-sans text-[13px] leading-[1.55] text-muted">
        {labels.transactional}
      </p>
      <div className="mt-[16px] flex gap-[8px]" role="tablist">
        {(["EMAIL", "SMS"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={channel === value}
            onClick={() => setChannel(value)}
            className={`inline-flex min-h-[42px] items-center gap-[7px] rounded-[4px] border px-[14px] font-sans text-[13px] font-medium ${channel === value ? "border-ink bg-ink text-white" : "border-line-btn text-body"}`}
          >
            {value === "EMAIL" ? (
              <EnvelopeSimple size={18} />
            ) : (
              <ChatText size={18} />
            )}
            {value === "EMAIL" ? labels.email : labels.sms}
          </button>
        ))}
      </div>
      <form
        action={sendAdminCommunicationAction}
        className="mt-[16px] grid gap-[13px]"
      >
        <input type="hidden" name="entity" value={entity} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="channel" value={channel} />
        <label className="font-sans text-[13px] text-muted">
          {labels.to}
          <input
            readOnly
            value={recipient ?? ""}
            className="mt-[6px] min-h-[44px] w-full rounded-[4px] border border-line-btn bg-page px-[12px] text-[15px] text-ink"
          />
        </label>
        {channel === "EMAIL" ? (
          <label className="font-sans text-[13px] text-muted">
            {labels.subject}
            <input
              required
              name="subject"
              maxLength={160}
              className="mt-[6px] min-h-[44px] w-full rounded-[4px] border border-line-btn bg-page px-[12px] text-[15px] text-ink"
            />
          </label>
        ) : null}
        <label className="font-sans text-[13px] text-muted">
          {labels.message}
          <textarea
            required
            name="body"
            rows={6}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="mt-[6px] w-full rounded-[4px] border border-line-btn bg-page px-[12px] py-[10px] text-[15px] text-ink"
          />
        </label>
        {channel === "SMS" ? (
          <p
            className={`font-sans text-[12px] ${sms.segments > 3 ? "text-red-700" : "text-muted"}`}
          >
            {labels.segments}: {sms.units} · {sms.encoding} · {sms.segments}/3
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!recipient || (channel === "SMS" && sms.segments > 3)}
          className="inline-flex min-h-[44px] w-fit items-center gap-[8px] rounded-[4px] bg-ink px-[18px] font-sans text-[12px] font-medium tracking-[.08em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-45"
        >
          {labels.send} <PaperPlaneTilt size={17} />
        </button>
      </form>
    </section>
  );
}
