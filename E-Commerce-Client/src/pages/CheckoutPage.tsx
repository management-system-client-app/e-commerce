import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../api";
import { money, titleCaseStatus } from "../format";
import { useAuth, useCart, useStore } from "../state";
import type { OrderResult } from "../types";

const payments = [
  { id: "COD", label: "Cash on delivery" },
  { id: "STRIPE", label: "Card" },
  { id: "BKASH", label: "bKash" },
  { id: "NAGAD", label: "Nagad" },
] as const;

type PayId = (typeof payments)[number]["id"];

export function CheckoutPage() {
  const { user } = useAuth();
  const { settings } = useStore();
  const { cart, refresh } = useCart();
  const [form, setForm] = useState({
    shippingFullName: "",
    shippingPhone: "",
    shippingLine1: "",
    shippingLine2: "",
    shippingCity: "",
    shippingState: "",
    shippingPostalCode: "",
    shippingCountry: "Bangladesh",
    email: "",
    customerNote: "",
    couponCode: "",
  });
  const [method, setMethod] = useState<PayId>("COD");
  const [shipping, setShipping] = useState<number | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [discountLabel, setDiscountLabel] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [txn, setTxn] = useState("");
  const [paidNote, setPaidNote] = useState("");

  useEffect(() => {
    if (user) {
      setForm((current) => ({
        ...current,
        shippingFullName: current.shippingFullName || `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        shippingPhone: current.shippingPhone || user.phone || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    const city = form.shippingCity.trim();
    if (city.length < 2 || cart.items.length === 0) {
      setShipping(null);
      return;
    }
    const timer = window.setTimeout(() => {
      api
        .quoteDelivery(city, cart.summary.subtotal)
        .then((quote) => {
          setShipping(Number(quote.shippingAmount));
          setZone(quote.zoneName);
        })
        .catch(() => {
          setShipping(null);
          setZone(null);
        });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [form.shippingCity, cart.summary.subtotal, cart.items.length]);

  async function applyCode(event: FormEvent) {
    event.preventDefault();
    setQuoteError("");
    try {
      const code = form.couponCode.trim();
      if (user && code) {
        try {
          const applied = await api.applyCoupon(code);
          setDiscount(Number(applied.discount));
          setDiscountLabel(applied.code);
          return;
        } catch {
          /* a promotion code is quoted below */
        }
      }
      const quote = await api.quotePromotion(code || undefined);
      setDiscount(Number(quote.discount));
      setDiscountLabel(quote.applied?.label ?? "");
    } catch (reason) {
      setDiscount(0);
      setDiscountLabel("");
      setQuoteError(reason instanceof Error ? reason.message : "Code was not applied");
    }
  }

  async function place(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.choosePayment(method);
      const placed = await api.placeOrder({
        shippingFullName: form.shippingFullName,
        shippingPhone: form.shippingPhone,
        shippingLine1: form.shippingLine1,
        shippingLine2: form.shippingLine2 || undefined,
        shippingCity: form.shippingCity,
        shippingState: form.shippingState || undefined,
        shippingPostalCode: form.shippingPostalCode,
        shippingCountry: form.shippingCountry,
        customerNote: form.customerNote || undefined,
        email: user ? undefined : form.email,
        couponCode: user && form.couponCode.trim() ? form.couponCode.trim() : undefined,
      });
      setOrder(placed);
      await refresh();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not place the order");
    } finally {
      setBusy(false);
    }
  }

  async function submitTxn(event: FormEvent) {
    event.preventDefault();
    if (!order) return;
    setPaidNote("");
    try {
      await api.submitManualPayment(
        user
          ? { orderId: order.id, transactionId: txn }
          : { orderNumber: order.orderNumber, phone: form.shippingPhone, transactionId: txn },
      );
      setPaidNote("Transaction id received. We will confirm the payment.");
    } catch (reason) {
      setPaidNote(reason instanceof Error ? reason.message : "Could not submit the transaction id");
    }
  }

  const fee = shipping ?? 0;
  const total = Math.max(cart.summary.subtotal - discount, 0) + fee;
  const wallet =
    order?.payTo ||
    (method === "BKASH" ? settings.bkashNumber : method === "NAGAD" ? settings.nagadNumber : null);

  if (order) {
    const payLabel = order.paymentMethod === "BKASH" ? "bKash" : order.paymentMethod === "NAGAD" ? "Nagad" : order.paymentMethod === "STRIPE" ? "Card" : "Cash on delivery";
    return (
      <div className="receipt-board">
        <article className="receipt">
          <p className="receipt-kicker">{settings.storeName}</p>
          <h1>Receipt</h1>
          <p className="receipt-number">{order.orderNumber}</p>
          <p className="note">{titleCaseStatus(order.status)} · {payLabel}</p>
          <div className="receipt-lines">
            {(order.items ?? []).map((item) => (
              <div className="sub" key={item.id}>
                <span>
                  {item.productName} × {item.quantity}
                  {item.size ? <small> {item.size}{item.color ? ` / ${item.color}` : ""}</small> : null}
                </span>
                <span>{money(item.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="sub"><span>Subtotal</span><span>{money(order.subtotal ?? order.total)}</span></div>
          <div className="sub"><span>Delivery</span><span>{money(order.shippingAmount ?? 0)}</span></div>
          <div className="sub"><span>Discount</span><span>{money(order.discountAmount ?? 0)}</span></div>
          <div className="sub receipt-total"><strong>Total</strong><strong>{money(order.total)}</strong></div>
          <p className="note">
            {order.shippingFullName}<br />
            {order.shippingLine1}{order.shippingCity ? `, ${order.shippingCity}` : ""} {order.shippingPostalCode}<br />
            {order.shippingPhone}
          </p>
          <p className="note">
            {order.emailed ? "A copy of this receipt was sent to your email." : "The receipt email could not be sent. This page and your account both keep the order."}
          </p>
          <p className="note">
            <Link to="/account/orders">See it in your orders</Link>
            {" · "}
            <Link to="/track">Track</Link>
          </p>
        </article>
        <aside className="pay-card panel">
          <p className="receipt-kicker">Payment</p>
          <h2>{payLabel}</h2>
          <p className="pay-amount">{money(order.total)}</p>
          {order.paymentMethod === "COD" ? <p>Pay cash when the order arrives. The order is already in your account.</p> : null}
          {order.paymentMethod === "STRIPE" ? (
            <button
              className="btn wide"
              type="button"
              onClick={() => {
                const open = (url: string | null | undefined) => {
                  if (url) window.location.assign(url);
                  else setPaidNote("Card checkout did not return a link");
                };
                if (order.checkoutUrl) {
                  open(order.checkoutUrl);
                  return;
                }
                api.createCheckout(order.id).then((checkout) => open(checkout.url)).catch((reason) => setPaidNote(reason instanceof Error ? reason.message : "Could not start card checkout"));
              }}
            >
              Pay by card
            </button>
          ) : null}
          {order.paymentMethod === "BKASH" || order.paymentMethod === "NAGAD" ? (
            <form onSubmit={submitTxn}>
              <p>Send {money(order.total)} to {wallet || "the store wallet"}, then enter the transaction id.</p>
              <label className="field">
                <span>Transaction id</span>
                <input value={txn} onChange={(event) => setTxn(event.target.value)} required minLength={4} />
              </label>
              <button className="btn wide" type="submit">Submit</button>
            </form>
          ) : null}
          {paidNote ? <p className="note">{paidNote}</p> : null}
        </aside>
      </div>
    );
  }

  return (
    <form className="checkout" onSubmit={place}>
      <div>
        <h1 className="label">Checkout</h1>
        <div style={{ height: 16 }} />
        <label className="field">
          <span>Full name</span>
          <input required value={form.shippingFullName} onChange={(event) => setForm({ ...form, shippingFullName: event.target.value })} />
        </label>
        <label className="field">
          <span>Phone</span>
          <input required minLength={7} value={form.shippingPhone} onChange={(event) => setForm({ ...form, shippingPhone: event.target.value })} />
        </label>
        {user ? null : (
          <label className="field">
            <span>Email</span>
            <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
        )}
        <label className="field">
          <span>Address</span>
          <input required value={form.shippingLine1} onChange={(event) => setForm({ ...form, shippingLine1: event.target.value })} />
        </label>
        <label className="field">
          <span>Address line 2</span>
          <input value={form.shippingLine2} onChange={(event) => setForm({ ...form, shippingLine2: event.target.value })} />
        </label>
        <label className="field">
          <span>City</span>
          <input required minLength={2} value={form.shippingCity} onChange={(event) => setForm({ ...form, shippingCity: event.target.value })} />
        </label>
        <label className="field">
          <span>State</span>
          <input value={form.shippingState} onChange={(event) => setForm({ ...form, shippingState: event.target.value })} />
        </label>
        <label className="field">
          <span>Postal code</span>
          <input required value={form.shippingPostalCode} onChange={(event) => setForm({ ...form, shippingPostalCode: event.target.value })} />
        </label>
        <label className="field">
          <span>Country</span>
          <input required value={form.shippingCountry} onChange={(event) => setForm({ ...form, shippingCountry: event.target.value })} />
        </label>
        <label className="field">
          <span>Note</span>
          <textarea value={form.customerNote} onChange={(event) => setForm({ ...form, customerNote: event.target.value })} />
        </label>
        <p className="option-label">Pay with</p>
        <div className="pay-grid">
          {payments.map((option) => (
            <label key={option.id} className={method === option.id ? "pay-card on" : "pay-card"}>
              <input type="radio" name="pay" checked={method === option.id} onChange={() => setMethod(option.id)} />
              <strong>{option.label}</strong>
              <span>
                {option.id === "BKASH" && settings.bkashNumber ? settings.bkashNumber : ""}
                {option.id === "NAGAD" && settings.nagadNumber ? settings.nagadNumber : ""}
                {option.id === "COD" ? "Pay at the door" : ""}
                {option.id === "STRIPE" ? "Visa, Mastercard" : ""}
              </span>
            </label>
          ))}
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn wide" type="submit" disabled={busy || cart.items.length === 0}>
          Place order
        </button>
      </div>
      <aside className="summary-box">
        <h2 className="label">Summary</h2>
        {cart.items.map((line) => (
          <div className="sub" key={line.id}>
            <span>
              {line.variant.product.name} × {line.quantity}
            </span>
            <span>{money(line.lineTotal)}</span>
          </div>
        ))}
        <div className="sub">
          <span>Subtotal</span>
          <span>{money(cart.summary.subtotal)}</span>
        </div>
        <div className="sub">
          <span>Delivery {zone ? `(${zone})` : ""}</span>
          <span>{shipping == null ? "—" : money(fee)}</span>
        </div>
        <div className="sub">
          <span>Discount {discountLabel}</span>
          <span>{money(discount)}</span>
        </div>
        <div className="sub">
          <strong>Total</strong>
          <strong>{money(total)}</strong>
        </div>
        {user ? (
          <form onSubmit={applyCode} className="news" style={{ marginTop: 12 }}>
            <input
              value={form.couponCode}
              placeholder="Code"
              aria-label="Discount code"
              onChange={(event) => setForm({ ...form, couponCode: event.target.value })}
            />
            <button type="submit">Apply</button>
          </form>
        ) : null}
        {quoteError ? <p className="error">{quoteError}</p> : null}
      </aside>
    </form>
  );
}
