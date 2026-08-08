/** Desk operator identity — matches GTM SENDER_* defaults. */
export const DESK_OPERATOR = {
  name: "Kirill Cheldishkin",
  title: "GTM · Candid",
  company: "Candid",
  initials: "KC",
  focus: "Infrastructure development",
  markets: "ERCOT · Storage · AI power",
  minScore: "80 / 100",
} as const;

/** Fallback when GTM mail status is unreachable (matches TEST_TO_EMAIL default). */
export const DEFAULT_DEMO_INBOX = "faruquitaymur@gmail.com";

export type MailStatus = {
  smtpConfigured?: boolean;
  sendMode?: string;
  canSendDemo?: boolean;
  draftOnly?: boolean;
  teamInbox?: string | null;
  senderEmail?: string | null;
  smtpHost?: string | null;
  error?: string;
};

export function resolveTeamInbox(mail: MailStatus | null | undefined): string {
  return mail?.teamInbox?.trim() || DEFAULT_DEMO_INBOX;
}
