"use client";

import { RfidSalesPanel } from "./rfid-sales-panel";
import { RfidIssueManagerPanel } from "./rfid-issue-manager-panel";

export function RfidCardsView() {
  return (
    <section className="content-single">
      <RfidIssueManagerPanel />
      <RfidSalesPanel />
    </section>
  );
}
