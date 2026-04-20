import jsPDF from "jspdf";

export interface StatementDelivery {
  order_id: string;
  order_number: number | null;
  restaurant: string;
  customer_address: string;
  delivered_at: string;
  driver_payout: number;
}

export interface StatementWithdrawal {
  id: string;
  amount: number;
  status: "pending" | "approved" | "paid" | "rejected";
  requested_at: string;
  paid_at: string | null;
  bank_name: string;
  bank_account_number: string;
}

export interface MonthlyStatementData {
  driver_name: string;
  period_label: string; // e.g. "April 2026"
  period_start: Date;
  period_end: Date;
  opening_balance: number; // earned minus locked withdrawals before period start
  deliveries: StatementDelivery[];
  withdrawals: StatementWithdrawal[];
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-ZA", { day: "2-digit", month: "short" });

const fmtDateLong = (d: Date) =>
  d.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

const fmtMoney = (n: number) => `R ${n.toFixed(2)}`;

export const generateMonthlyStatement = (s: MonthlyStatementData) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  // Header
  doc.setFillColor(255, 90, 0);
  doc.rect(0, 0, pageW, 80, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Mfula", margin, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Monthly Earnings Statement", margin, 60);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(s.period_label, pageW - margin, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${fmtDateLong(s.period_start)} – ${fmtDateLong(s.period_end)}`,
    pageW - margin,
    58,
    { align: "right" }
  );

  // Driver
  let y = 104;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("DRIVER", margin, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(s.driver_name || "—", margin, y + 16);

  // Totals
  const totalEarned = s.deliveries.reduce((sum, d) => sum + Number(d.driver_payout), 0);
  const paidWithdrawals = s.withdrawals
    .filter((w) => w.status === "paid")
    .reduce((sum, w) => sum + Number(w.amount), 0);
  const pendingWithdrawals = s.withdrawals
    .filter((w) => w.status === "pending" || w.status === "approved")
    .reduce((sum, w) => sum + Number(w.amount), 0);
  const closingBalance = s.opening_balance + totalEarned - paidWithdrawals - pendingWithdrawals;

  // Summary tiles
  y = 150;
  const tileW = (pageW - margin * 2 - 20) / 3;
  const tileH = 68;
  const drawTile = (x: number, label: string, value: string, sub?: string) => {
    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(x, y, tileW, tileH, 6, 6, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(label.toUpperCase(), x + 12, y + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(30, 30, 30);
    doc.text(value, x + 12, y + 40);
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(sub, x + 12, y + 56);
    }
  };
  drawTile(margin, "Deliveries", String(s.deliveries.length), `${fmtMoney(totalEarned)} earned`);
  drawTile(margin + tileW + 10, "Paid out", fmtMoney(paidWithdrawals), `${s.withdrawals.filter((w) => w.status === "paid").length} withdrawals`);
  drawTile(margin + (tileW + 10) * 2, "Closing balance", fmtMoney(Math.max(0, closingBalance)), "After pending");

  y += tileH + 20;

  // Balance summary table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text("Balance Summary", margin, y);
  y += 10;

  const lineRow = (label: string, value: string, bold = false) => {
    doc.setDrawColor(240, 240, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 14;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(10);
    doc.setTextColor(bold ? 30 : 80, bold ? 30 : 80, bold ? 30 : 80);
    doc.text(label, margin, y);
    doc.text(value, pageW - margin, y, { align: "right" });
    y += 8;
  };
  lineRow("Opening balance", fmtMoney(s.opening_balance));
  lineRow(`Earnings (${s.deliveries.length} deliveries)`, `+ ${fmtMoney(totalEarned)}`);
  lineRow("Paid withdrawals", `− ${fmtMoney(paidWithdrawals)}`);
  lineRow("Pending / approved (locked)", `− ${fmtMoney(pendingWithdrawals)}`);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineWidth(0);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text("Closing balance", margin, y);
  doc.setTextColor(34, 139, 34);
  doc.text(fmtMoney(Math.max(0, closingBalance)), pageW - margin, y, { align: "right" });
  y += 22;

  // Helpers for page overflow
  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 50) {
      doc.addPage();
      y = margin;
    }
  };

  // Deliveries table
  ensureSpace(60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(`Deliveries (${s.deliveries.length})`, margin, y);
  y += 12;

  // Column layout: Date | Order # | Restaurant | Address | Payout
  const col = {
    date: margin,
    order: margin + 50,
    rest: margin + 95,
    addr: margin + 215,
    payout: pageW - margin,
  };
  const headerRow = () => {
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, pageW - margin * 2, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("DATE", col.date + 4, y + 12);
    doc.text("ORDER", col.order, y + 12);
    doc.text("RESTAURANT", col.rest, y + 12);
    doc.text("ADDRESS", col.addr, y + 12);
    doc.text("PAYOUT", col.payout - 4, y + 12, { align: "right" });
    y += 22;
  };

  headerRow();
  if (s.deliveries.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text("No deliveries in this period.", margin, y + 2);
    y += 16;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    for (const d of s.deliveries) {
      ensureSpace(22);
      if (y + 4 > pageH - 50) {
        doc.addPage();
        y = margin;
        headerRow();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
      }
      doc.text(fmtDate(d.delivered_at), col.date + 4, y + 4);
      doc.text(d.order_number ? `#${d.order_number}` : "—", col.order, y + 4);
      const rest = doc.splitTextToSize(d.restaurant || "—", col.addr - col.rest - 6)[0] || "—";
      doc.text(rest, col.rest, y + 4);
      const addr = doc.splitTextToSize(d.customer_address || "—", col.payout - col.addr - 50)[0] || "—";
      doc.text(addr, col.addr, y + 4);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 139, 34);
      doc.text(`+${fmtMoney(Number(d.driver_payout))}`, col.payout - 4, y + 4, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      y += 16;
      doc.setDrawColor(245, 245, 245);
      doc.line(margin, y - 4, pageW - margin, y - 4);
    }
  }

  y += 16;

  // Withdrawals table
  ensureSpace(60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(`Withdrawals (${s.withdrawals.length})`, margin, y);
  y += 12;

  const wcol = {
    date: margin,
    status: margin + 70,
    bank: margin + 140,
    amount: pageW - margin,
  };
  const wHeader = () => {
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, pageW - margin * 2, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("REQUESTED", wcol.date + 4, y + 12);
    doc.text("STATUS", wcol.status, y + 12);
    doc.text("BANK", wcol.bank, y + 12);
    doc.text("AMOUNT", wcol.amount - 4, y + 12, { align: "right" });
    y += 22;
  };
  wHeader();
  if (s.withdrawals.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text("No withdrawals in this period.", margin, y + 2);
    y += 16;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    for (const w of s.withdrawals) {
      ensureSpace(22);
      if (y + 4 > pageH - 50) {
        doc.addPage();
        y = margin;
        wHeader();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
      }
      doc.text(fmtDate(w.requested_at), wcol.date + 4, y + 4);
      const statusColors: Record<string, [number, number, number]> = {
        paid: [34, 139, 34],
        approved: [37, 99, 235],
        pending: [180, 120, 0],
        rejected: [200, 40, 40],
      };
      const [r, g, b] = statusColors[w.status] || [80, 80, 80];
      doc.setTextColor(r, g, b);
      doc.setFont("helvetica", "bold");
      doc.text(w.status.toUpperCase(), wcol.status, y + 4);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const last4 = (w.bank_account_number || "").slice(-4);
      doc.text(`${w.bank_name} ••••${last4}`, wcol.bank, y + 4);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(w.status === "paid" ? 34 : 60, w.status === "paid" ? 139 : 60, w.status === "paid" ? 34 : 60);
      doc.text(`− ${fmtMoney(Number(w.amount))}`, wcol.amount - 4, y + 4, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      y += 16;
      doc.setDrawColor(245, 245, 245);
      doc.line(margin, y - 4, pageW - margin, y - 4);
    }
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, pageH - 40, pageW - margin, pageH - 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Mfula · ${s.period_label} statement · Generated ${new Date().toLocaleString("en-ZA")}`,
      margin,
      pageH - 24
    );
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 24, { align: "right" });
  }

  const slug = s.period_label.toLowerCase().replace(/\s+/g, "-");
  doc.save(`mfula-statement-${slug}.pdf`);
};
