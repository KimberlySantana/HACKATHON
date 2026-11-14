# Splitzy proportional splitting contract

This document defines the handoff between the receipt scanner and the group-splitting feature. It is intentionally an integration contract: it does not require changes to the existing group page or to `src/types/index.ts`.

## Ownership boundary

- The scanner owns receipt recognition, editable receipt fields, and receipt review flags.
- The group feature owns groups, members, item assignment, and the final split experience.
- The split calculation should be a pure function under `src/lib/splitting/`; it should not depend on React, browser state, or OpenAI.
- Finalization must be blocked when required review or assignment checks fail.

## Existing source data

The scanner currently produces the shared `Receipt` shape:

```ts
type Receipt = {
  id: string;
  groupId: string;
  merchant: string;
  date: string;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  items: ReceiptItem[];
};

type ReceiptItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  assignedMemberIds: string[];
};
```

The scanner also returns review metadata. The split feature should receive that metadata or an equivalent `tipConfirmed` value. A numeric `tip: 0` is not proof that the user confirmed a zero tip.

## Recommended integration input

Use a derived input object at the splitting boundary rather than changing the shared receipt contract:

```ts
type SplitReceiptInput = {
  receipt: Receipt;
  memberIds: string[];
  tipConfirmed: boolean;
  reviewFlags: {
    needsReview: boolean;
    needsConfirmation: boolean;
    fields: string[];
    notes: string[];
  };
  adjustments?: ReceiptAdjustment[];
};

type ReceiptAdjustment = {
  id: string;
  kind: "discount" | "service_charge";
  label: string;
  amountCents: number;
  includedInSubtotal: boolean;
  includedInTotal: boolean;
  confirmed: boolean;
};
```

`memberIds` should come from the active group. Every ID in `assignedMemberIds` must exist in that list.

## Required validation before calculation

The calculation must return review errors and `canFinalize: false` when any of these checks fail:

1. Every receipt item has at least one assigned member.
2. Every assigned member ID belongs to the active group.
3. There are no duplicate member IDs within one item assignment.
4. The itemized subtotal matches the sum of item totals within one cent. If not, flag `subtotal` and block finalization until the user confirms or corrects it.
5. The receipt has a confirmed tip. If the scanner marked the tip missing, blank, suggested-only, or unclear, do not treat the numeric placeholder as a confirmed zero.
6. A detected discount or service charge has a confirmed inclusion state. Do not finalize while it is unclear whether the amount is already included in the subtotal or total.
7. Receipt totals are non-negative and represented as finite numbers.

## Calculation rules

### 1. Work in integer cents

Convert every monetary value once at the calculation boundary:

```ts
const cents = (amount: number) => Math.round(amount * 100);
```

Do not allocate using floating-point dollars. Convert back to dollars only for display.

### 2. Split each item first

For an item assigned to one member, that member receives the entire item total.

For an item assigned to multiple members, split the item total equally unless the group feature later adds explicit per-member quantities. Use deterministic cent allocation:

```text
item total cents ÷ number of assigned members
floor each share
give leftover cents one at a time in stable member-id order
```

The resulting item shares must sum exactly to the item total. Keep the derived shares for the final itemized breakdown:

```ts
type ItemShare = {
  itemId: string;
  memberId: string;
  amountCents: number;
};
```

### 3. Calculate each member’s food-and-drink basis

For each member:

```text
member basis cents = sum of that member’s assigned item shares
total basis cents  = sum of all member basis cents
member proportion  = member basis cents / total basis cents
```

The total basis should equal the validated receipt subtotal. If it does not, block finalization rather than silently scaling the result.

### 4. Allocate tax and tip independently

Allocate the receipt tax and confirmed actual tip using the same proportions:

```text
member tax cents = receipt tax cents × member basis cents ÷ total basis cents
member tip cents = receipt tip cents × member basis cents ÷ total basis cents
```

Use the largest-remainder method for each charge independently:

1. Calculate each exact fractional share.
2. Assign each member the floor in cents.
3. Calculate remaining cents after floors.
4. Give one extra cent to members with the largest fractional remainders.
5. Break ties by stable `memberId` order.

This guarantees that allocated tax equals receipt tax and allocated tip equals receipt tip exactly.

### 5. Build final member totals

```text
member final cents
  = item subtotal cents
  + allocated tax cents
  + allocated tip cents
  + confirmed adjustments cents
```

The sum of all member final amounts must equal the final receipt total exactly. If it does not, return a discrepancy flag and `canFinalize: false`.

## Discounts and service charges

Discounts and service charges need explicit review because they may already be reflected in the itemized subtotal or final total.

- If an adjustment is already included in the receipt subtotal/total, do not add it again.
- If an adjustment is separate and confirmed as not included, represent it once in `adjustments` and allocate it deliberately. The recommended default is proportional allocation by each member’s item subtotal.
- If the scanner detects an adjustment but cannot determine whether it is included, flag `adjustment` and block finalization.
- Never infer a service charge is a tip. Keep it separate and label it clearly.

## Recommended calculation output

Return a result shaped like this so the UI can render an itemized breakdown without recomputing money:

```ts
type SplitResult = {
  receiptId: string;
  canFinalize: boolean;
  receiptTotalCents: number;
  allocatedTotalCents: number;
  totalsMatch: boolean;
  reviewFlags: string[];
  reviewNotes: string[];
  members: MemberBreakdown[];
};

type MemberBreakdown = {
  memberId: string;
  basisCents: number;
  proportionBps: number; // display-only basis points; calculation uses cents
  items: Array<{
    itemId: string;
    name: string;
    amountCents: number;
  }>;
  itemSubtotalCents: number;
  taxCents: number;
  tipCents: number;
  adjustmentCents: number;
  finalCents: number;
};
```

The UI should display, for each person:

- Their assigned item lines and shared-item portions
- Food and drink subtotal
- Proportional tax
- Proportional tip
- Any confirmed discount/service-charge adjustment
- Final amount due

## Example

Suppose the assigned item shares are:

| Member | Item shares | Basis | Proportion |
| --- | --- | ---: | ---: |
| Maya | $20.00 | $20.00 | 66.67% |
| Jules | $5.00 shared item portion | $5.00 | 16.67% |
| Alex | $5.00 shared item portion | $5.00 | 16.67% |

For a `$30.00` subtotal, `$3.00` tax, and `$6.00` confirmed tip:

| Member | Items | Tax | Tip | Final |
| --- | ---: | ---: | ---: | ---: |
| Maya | $20.00 | $2.00 | $4.00 | $26.00 |
| Jules | $5.00 | $0.50 | $1.00 | $6.50 |
| Alex | $5.00 | $0.50 | $1.00 | $6.50 |
| Total | $30.00 | $3.00 | $6.00 | $39.00 |

## Finalization checklist

The “Finalize split” action should remain disabled until:

- All items are assigned.
- Shared-item allocations sum to each item total.
- The receipt subtotal matches the assigned item basis.
- Tax and confirmed tip allocations sum exactly to the receipt values.
- Discounts/service charges are confirmed and counted once.
- The two-receipt transaction confirmation has been resolved, if applicable.
- The sum of member totals equals the final receipt total in cents.

If any check fails, keep the editable receipt and assignment UI available, show the specific review note, and do not create settlement expenses.
