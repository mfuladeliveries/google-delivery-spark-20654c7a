// Durable queue is populated transactionally when payment_status becomes paid.
// deno-lint-ignore no-explicit-any
export async function deliverPaymentNotifications(client: any, orderId?: string) {
  const { data: jobs, error } = await client.rpc("claim_payment_notifications", { p_order_id: orderId ?? null });
  if (error) throw new Error(error.message);
  for (const job of jobs ?? []) {
    const { data, error: pushError } = await client.functions.invoke("push-notify", {
      body: { order_id: job.order_id, status: "payment_received" },
    });
    const failure = pushError?.message || data?.error || (data?.failed ? "Some payment notifications failed" : null);
    await client.from("payment_notification_outbox").update({
      sent_at: failure ? null : new Date().toISOString(),
      last_error: failure,
      available_at: new Date(Date.now() + 60000 * Math.min(30, job.attempts)).toISOString(),
      lease_token: null, lease_until: null,
    }).eq("order_id", job.order_id).eq("lease_token", job.lease_token);
  }
}