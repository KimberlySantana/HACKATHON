import { formatCents, type SettlementMember, type Transfer } from "./calculations.ts";
import type { CurrencyCode } from "../currency/types.ts";

/** Builds a plain-text summary from the group's actual calculated transfers. */
export function buildSettlementCopySummary(groupName: string, transfers: Transfer[], members: SettlementMember[], currency: CurrencyCode = "USD"): string {
  const names = new Map(members.map((member) => [member.id, member.name]));
  const lines = transfers.map((transfer) => {
    const payer = names.get(transfer.fromMemberId) ?? "Group member";
    const recipient = names.get(transfer.toMemberId) ?? "Group member";
    return `${payer} pays ${recipient} ${formatCents(transfer.amountCents, currency)}`;
  });

  return [`Splitzy · ${groupName}`, "", ...(lines.length ? lines : ["No transfers are needed."])].join("\n");
}
