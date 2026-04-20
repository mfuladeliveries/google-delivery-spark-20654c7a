import jsPDF from "jspdf";

export interface WithdrawalReceiptData {
  id: string;
  amount: number;
  driver_name: string;
  bank_account_holder: string;
  bank_name: string;
  bank_account_number: string;
  bank_branch_code: string;
  bank_account_type: string;
  requested_at: string;
  approved_at: string | null;
  paid_at: string | null;
}

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const maskAccount = (acct: string) => {
  if (!acct) return "••••";
  const last4 = acct.slice(-4);
  return `•••• •••• ${last4}`;
};

export const generateWithdrawalReceipt = (r: WithdrawalReceiptData) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;

  // Header band
  doc.setFillColor(255, 90, 0); // Mfula Orange
  doc.rect(0, 0, pageW, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Mfula", margin, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Payout Receipt", margin, 66);

  // PAID badge
  doc.setFillColor(34, 197, 94);
  doc.roundedRect(pageW - margin - 80, 30, 80, 30, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("PAID", pageW - margin - 40, 50, { align: "center" });

  // Reset
  doc.setTextColor(30, 30, 30);

  // Amount block
  let y = 130;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text("Amount paid", margin, y);
  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(30, 30, 30);
  doc.text(`R ${r.amount.toFixed(2)}`, margin, y);

  // Divider
  y += 24;
  doc.setDrawColor(230, 230, 230);
  doc.line(margin, y, pageW - margin, y);

  // Two-column details
  const leftX = margin;
  const rightX = pageW / 2 + 10;
  const rowGap = 38;
  let rowY = y + 28;

  const drawField = (x: number, ry: number, label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(label.toUpperCase(), x, ry);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(value || "—", x, ry + 14);
  };

  drawField(leftX, rowY, "Receipt ID", r.id.slice(0, 8).toUpperCase());
  drawField(rightX, rowY, "Driver", r.driver_name || "—");
  rowY += rowGap;

  drawField(leftX, rowY, "Requested", fmtDate(r.requested_at));
  drawField(rightX, rowY, "Approved", fmtDate(r.approved_at));
  rowY += rowGap;

  drawField(leftX, rowY, "Paid on", fmtDate(r.paid_at));
  drawField(rightX, rowY, "Status", "Paid");
  rowY += rowGap + 6;

  // Bank details card
  doc.setDrawColor(230, 230, 230);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(margin, rowY, pageW - margin * 2, 120, 8, 8, "FD");
  const bX = margin + 18;
  let bY = rowY + 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text("Paid to", bX, bY);
  bY += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(r.bank_account_holder || "—", bX, bY);
  bY += 16;
  doc.text(`${r.bank_name}  ·  ${r.bank_account_type}`, bX, bY);
  bY += 16;
  doc.text(`Account ${maskAccount(r.bank_account_number)}`, bX, bY);
  bY += 16;
  doc.text(`Branch ${r.bank_branch_code || "—"}`, bX, bY);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 60;
  doc.setDrawColor(230, 230, 230);
  doc.line(margin, footerY, pageW - margin, footerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 130);
  doc.text(
    "This is an electronic receipt from Mfula. Account numbers are masked for security.",
    margin,
    footerY + 18
  );
  doc.text(
    `Generated ${new Date().toLocaleString("en-ZA")}`,
    margin,
    footerY + 32
  );

  const filename = `mfula-withdrawal-${r.id.slice(0, 8)}.pdf`;
  doc.save(filename);
};
