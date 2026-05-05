"use client";

import CheckoutPage from "@/components/CheckoutPage.js";
import convertToSubcurrency from "@/lib/end-user/convertToSubcurrency";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

if (process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY === undefined) {
  throw new Error("NEXT_PUBLIC_STRIPE_PUBLIC_KEY is not defined");
}
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY);

export default function Home() {
  const searchParams = useSearchParams();

  const [eventId, setEventId] = useState("");
  const [eventName, setEventName] = useState("");
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState(0.01);

  // populate from query params once on mount / when search params change
  useEffect(() => {
    if (!searchParams) return;
    const qEventId = searchParams.get("eventId") || "";
    const qEventName = searchParams.get("eventName") || "";
    const qUserId = searchParams.get("userId") || "";
    const qAmount = searchParams.get("amount");
    setEventId(qEventId);
    setEventName(qEventName);
    setUserId(qUserId);
    if (qAmount !== null) {
      const n = Number(qAmount);
      if (!Number.isNaN(n)) setAmount(n);
    }
  }, [searchParams]);

  return (
    <main className="max-w-6xl mx-auto p-10 text-white text-center border m-10 rounded-md bg-gradient-to-tr from-blue-500 to-purple-500">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold mb-2">{eventName || "Payment"}</h1>
        <h2 className="text-2xl">
          has requested
          <span className="font-bold"> ${Number(amount).toFixed(2)}</span>
        </h2>
      </div>

      <Elements
        stripe={stripePromise}
        options={{
          mode: "payment",
          amount: convertToSubcurrency(amount),
          currency: "usd",
        }}
      >
        <CheckoutPage amount={amount} eventId={eventId} userId={userId} />
      </Elements>
    </main>
  );
}