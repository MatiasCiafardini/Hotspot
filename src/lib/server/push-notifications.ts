import webpush, { type PushSubscription } from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { formatMoney, shortOrderId, type AdminOrder } from "@/lib/admin";

type StoredPushSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function getVapidPublicKey() {
  return getVapidConfig()?.publicKey ?? null;
}

export async function sendNewOrderPush(order: AdminOrder, storeId: number) {
  const config = getVapidConfig();
  if (!config) return;

  const { data, error } = await (supabaseAdmin as any)
    .from("admin_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("store_id", storeId);
  if (error || !data?.length) return;

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const payment = order.payment_method === "efectivo" ? "Efectivo" : "Transferencia";
  const delivery = order.delivery_method === "delivery" ? "Delivery" : "Retiro";
  const payload = JSON.stringify({
    title: `Nuevo pedido ${shortOrderId(order.id)}`,
    body: `${order.customer_name} · ${formatMoney(order.total)} · ${payment} · ${delivery}`,
    orderId: order.id,
    tag: `order-${order.id}`,
    url: `/admin/pedidos?pedido=${encodeURIComponent(order.id)}`,
  });

  await Promise.allSettled(
    (data as StoredPushSubscription[]).map(async (stored) => {
      const subscription: PushSubscription = {
        endpoint: stored.endpoint,
        keys: { p256dh: stored.p256dh, auth: stored.auth },
      };
      try {
        await webpush.sendNotification(subscription, payload, { TTL: 300, urgency: "high" });
        await (supabaseAdmin as any)
          .from("admin_push_subscriptions")
          .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", stored.id);
      } catch (pushError) {
        const statusCode = (pushError as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await (supabaseAdmin as any)
            .from("admin_push_subscriptions")
            .delete()
            .eq("id", stored.id);
        }
      }
    }),
  );
}
