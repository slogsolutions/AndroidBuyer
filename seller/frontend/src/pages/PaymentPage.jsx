import React from "react";

const PaymentPage = ({ booking }) => {
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";
  const RZP_KEY = import.meta.env.VITE_RAZORPAY_KEY;
  console.log("RZP_KEY being used:", RZP_KEY); // Debug log
  if (!RZP_KEY) {
    throw new Error("VITE_RAZORPAY_KEY is not set. Add your LIVE key_id to .env");
  }
  console.log("🧾 RAZORPAY KEY from env:", import.meta.env.VITE_RAZORPAY_KEY);

  // const RZP_KEY = import.meta.env.VITE_RAZORPAY_KEY || "rzp_test_eQoJ7XZxUf37D7";
  const handlePayment = async () => {
    try {
      // 1) Create Razorpay order on backend
      const initRes = await fetch(`${API_BASE}/payment/initiate-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({
          bookingId: booking._id,
          amount: booking.totalPrice, isPaise: false // INR, backend multiplies to paise
        }),
      });

      if (!initRes.ok) {
        const e = await initRes.json().catch(() => ({}));
        alert(`Failed to initiate payment: ${e.error || initRes.statusText}`);
        return;
      }

      const { orderId, amount, currency } = await initRes.json();

      // 2) Open Razorpay checkout using the created order
      const options = {
        key: RZP_KEY,
        amount,                  // from backend (already in paise)
        currency: currency || "INR",
        name: "Parking Booking Payment",
        description: `Payment for booking ID: ${booking._id}`,
        order_id: orderId,       // <-- IMPORTANT
        handler: async function (response) {
          // response has: razorpay_payment_id, razorpay_order_id, razorpay_signature
          try {
            const verifyRes = await fetch(`${API_BASE}/payment/verify-payment`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
              },
              body: JSON.stringify({
                bookingId: booking._id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (!verifyRes.ok) {
              if (verifyRes.status === 409) {
                const data = await verifyRes.json().catch(() => ({}));
                alert(
                  data.error ||
                    "Payment succeeded but no spot remained. Please contact support."
                );
                return;
              }
              const data = await verifyRes.json().catch(() => ({}));
              alert(data.error || "Payment verification failed. Please contact support.");
              return;
            }

            const result = await verifyRes.json();
            // Backend has now decremented availableSpots atomically.
            // If you want instant UI update in addition to sockets:
            // - result.parking has updated availableSpots
            // - update your local/global parking list here if needed.

            alert("Payment verified successfully! Your spot is reserved.");
            console.log("Verify result:", result);
          } catch (err) {
            console.error("Error verifying payment:", err);
            alert("An error occurred while verifying payment.");
          }
        },
        prefill: {
          name: "User Name",
          email: "user@example.com",
          contact: "1234567890",
        },
        theme: { color: "#3399cc" },
        modal: {
          ondismiss: function () {
            // User closed Razorpay modal
            console.log("Razorpay modal closed by user");
          },
        },
      };

      if (!window.Razorpay) {
        alert("Razorpay SDK not loaded. Please check your script include.");
        return;
      }

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Payment init/open error:", err);
      alert("Failed to start payment. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Payment</h2>
        <p className="text-gray-600 mb-4">
          You're about to pay for booking ID:{" "}
          <span className="font-medium">{booking._id}</span>
        </p>
        <p className="text-gray-800 mb-6">
          Total Price:{" "}
          <span className="font-bold text-green-600">₹{booking.totalPrice}</span>
        </p>
        <button
          onClick={handlePayment}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition duration-300"
        >
          Pay Now
        </button>
      </div>
    </div>
  );
};

export default PaymentPage;
