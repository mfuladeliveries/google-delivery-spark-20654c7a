import { AlertTriangle } from "lucide-react";
import { PAYMENT_CANCELLATION_WARNING } from "@/lib/orderCancellation";

export default function PaymentCancellationWarning() {
  return (
    <div role="note" className="mt-4 flex gap-3 border-l-4 border-primary bg-primary/10 p-4 text-sm font-medium leading-relaxed text-foreground">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <p>{PAYMENT_CANCELLATION_WARNING}</p>
    </div>
  );
}