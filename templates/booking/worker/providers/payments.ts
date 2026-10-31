import { fail, integer, object, text } from "../../src/domain/validation.ts";
import { digest, equal } from "../security.ts";
import type { Env, PaymentRow } from "../types.ts";

export interface ProviderStatus {
  reference: string;
  amount: number;
  transactionId: string;
  state: "pending" | "paid" | "failed_attempt" | "expired" | "refunded";
  refundedAmount: number;
  refundConfirmed: boolean;
}
export interface PaymentProvider {
  id: string;
  create(payment: PaymentRow, minutes: number): Promise<string>;
  status(reference: string): Promise<ProviderStatus>;
  authenticate(payload: unknown): Promise<string>;
  refund(
    payment: PaymentRow,
    key: string,
    amount: number,
    reason: string,
  ): Promise<void>;
}
function amount(value: unknown): number {
  if (!/^[0-9]+(?:\.0{1,2})?$/.test(String(value)))
    fail(502, "PROVIDER_AMOUNT", "The provider returned an invalid amount.");
  return integer(Number(value), "Provider amount", 0, 2_000_000_000);
}
/** Server-only adapter. Redirects and browser callbacks never enter the ledger. */
export function midtrans(env: Env): PaymentProvider {
  const key = env.MIDTRANS_SERVER_KEY;
  if (!key)
    fail(
      503,
      "PAYMENT_NOT_CONFIGURED",
      "Configure the server payment key before accepting online payment.",
    );
  const live = env.MIDTRANS_ENVIRONMENT === "production",
    api = live
      ? "https://api.midtrans.com"
      : "https://api.sandbox.midtrans.com",
    app = live
      ? "https://app.midtrans.com"
      : "https://app.sandbox.midtrans.com";
  async function call(
    path: string,
    method = "GET",
    body?: unknown,
    snap = false,
  ) {
    let response: Response;
    try {
      response = await fetch((snap ? app : api) + path, {
        method,
        headers: {
          Authorization: `Basic ${btoa(`${key}:`)}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      return fail(
        502,
        "PROVIDER_UNAVAILABLE",
        "Payment provider did not respond. Your appointment remains saved.",
      );
    }
    let data: Record<string, unknown>;
    try {
      data = object(await response.json());
    } catch {
      return fail(
        502,
        "PROVIDER_RESPONSE",
        "Invalid payment provider response.",
      );
    }
    if (String(data.status_code) === "404")
      fail(
        409,
        "PAYMENT_NOT_STARTED",
        "No payment method has been selected at the provider yet.",
      );
    if (
      !response.ok ||
      ("status_code" in data &&
        !["200", "201", "202"].includes(String(data.status_code)))
    )
      fail(
        502,
        "PROVIDER_REJECTED",
        "Payment provider could not process this request. Keep the appointment reference and retry.",
      );
    return data;
  }
  return {
    id: "midtrans",
    async create(payment, minutes) {
      // Reuse the same order reference after an uncertain response. Never create a second charge.
      const data = await call(
        "/snap/v1/transactions",
        "POST",
        {
          transaction_details: {
            order_id: payment.reference,
            gross_amount: payment.amount,
          },
          expiry: {
            unit: "minutes",
            duration: Math.max(1, Math.min(1440, minutes)),
          },
          credit_card: { secure: true },
        },
        true,
      );
      let url: URL;
      try {
        url = new URL(String(data.redirect_url));
      } catch {
        return fail(502, "PROVIDER_URL", "Payment URL is unavailable.");
      }
      if (url.origin !== app || url.username || url.password)
        fail(502, "PROVIDER_URL", "Untrusted payment URL.");
      return url.href;
    },
    async authenticate(payload) {
      const raw = object(payload),
        reference = text(raw.order_id, "Provider reference", 50, true),
        signature = text(raw.signature_key, "Signature", 128, true);
      const expected = await digest(
        `${reference}${text(raw.status_code, "Status code", 3, true)}${text(raw.gross_amount, "Gross amount", 30, true)}${key}`,
        "SHA-512",
      );
      if (
        !/^[a-f0-9]{128}$/i.test(signature) ||
        !equal(signature.toLowerCase(), expected)
      )
        fail(403, "INVALID_SIGNATURE", "Invalid payment signature.");
      return reference;
    },
    async status(reference) {
      const data = await call(`/v2/${encodeURIComponent(reference)}/status`),
        state = String(data.transaction_status);
      const success =
        String(data.status_code) === "200" &&
        (state === "settlement" ||
          (state === "capture" && data.fraud_status === "accept"));
      const refundedAmount =
        data.refund_amount === undefined ? 0 : amount(data.refund_amount);
      const refunds = Array.isArray(data.refunds)
        ? data.refunds.map((value) => object(value))
        : [];
      const refundConfirmed =
        Boolean(data.bank_confirmed_at) ||
        (refunds.length > 0 &&
          refunds.every((r) => Boolean(r.bank_confirmed_at)));
      return {
        reference: text(data.order_id, "Order reference", 50, true),
        amount: amount(data.gross_amount),
        transactionId: text(data.transaction_id, "Transaction ID", 100),
        state: success
          ? "paid"
          : ["refund", "partial_refund"].includes(state)
            ? "refunded"
            : ["expire", "cancel"].includes(state)
              ? "expired"
              : ["deny", "failure"].includes(state)
                ? "failed_attempt"
                : "pending",
        refundedAmount,
        refundConfirmed,
      };
    },
    async refund(payment, refundKey, value, reason) {
      await call(
        `/v2/${encodeURIComponent(payment.reference)}/refund`,
        "POST",
        { refund_key: refundKey, amount: value, reason },
      );
      // An accepted refund request is not proof that the customer's bank received it.
    },
  };
}
/** Add providers here. Credentials and implementations must stay outside the browser bundle. */
export const paymentProviders: Record<string, (env: Env) => PaymentProvider> = {
  midtrans,
};
