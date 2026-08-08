"use client";

import { useEffect, useState } from "react";
import {
  resolveTeamInbox,
  type MailStatus,
} from "@/lib/desk-profile";

export function useMailStatus() {
  const [mail, setMail] = useState<MailStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mail/status")
      .then((r) => r.json())
      .then((payload: MailStatus) => {
        if (!cancelled) setMail(payload);
      })
      .catch(() => {
        if (!cancelled) {
          setMail({
            canSendDemo: false,
            draftOnly: true,
            sendMode: "mock",
            teamInbox: null,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    mail,
    teamInbox: resolveTeamInbox(mail),
    canSendDemo: Boolean(mail?.canSendDemo),
    draftOnly: mail?.draftOnly !== false && !mail?.canSendDemo,
    sendMode: mail?.sendMode ?? "mock",
    senderEmail: mail?.senderEmail ?? null,
  };
}
