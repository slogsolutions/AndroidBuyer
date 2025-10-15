import React, { useState } from 'react';

type Props = {
  formData: { aadhaarNumber: string };
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOtpSent?: (info?: any) => void;
  onOtpValidated?: (responseData?: any) => void;
};

function generateUUID(): string {
  // Prefer native crypto.randomUUID if available
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      // @ts-ignore
      return crypto.randomUUID();
    } catch (e) {
      // fall through to fallback
    }
  }
  // Fallback simple UUID-like generator
  return 'ref-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

export default function AadhaarValidationForm({ formData, onChange, onOtpSent, onOtpValidated }: Props) {
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async () => {
    setLoading(true);
    setError(null);

    if (!formData.aadhaarNumber || formData.aadhaarNumber.trim().length === 0) {
      setError('Please enter Aadhaar number');
      setLoading(false);
      return;
    }

    try {
      // Create and persist a reference_id for this transaction
      const reference_id = generateUUID();
      localStorage.setItem('reference_id', reference_id);

      const payload = {
        reference_id,
        consent: true,
        purpose: 'for bank account verification',
        aadhaar_number: formData.aadhaarNumber,
      };

      const res = await fetch(`${import.meta.env.VITE_BASE_URL}/proxy/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error('send-otp error', data);
        // If server returns a message field, show it; otherwise generic
        throw new Error(data?.message || 'Failed to send OTP');
      }

      // Save the transaction id that the backend/decentro returned (decentroTxnId or initiation_transaction_id)
      // Use whichever is present (decentroTxnId is common in your screenshots)
      const txnId =
        data.initiation_transaction_id ||
        data.initiationTransactionId ||
        data.decentroTxnId ||
        data.decentro_txn_id ||
        data.txn_id ||
        null;

      if (txnId) {
        localStorage.setItem('decentroTxnId', txnId);
      } else {
        // still proceed — some flows may not return explicit txn id, but you should be aware
        console.warn('No initiation/decentro transaction id returned by generate response', data);
      }

      setOtpSent(true);
      onOtpSent?.(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateOtp = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use the same reference_id you saved during send-otp
      const reference_id = localStorage.getItem('reference_id');
      const initiation_transaction_id = localStorage.getItem('decentroTxnId'); // saved from generate response

      if (!reference_id) {
        throw new Error('Reference ID missing. Please request OTP again.');
      }
      if (!initiation_transaction_id) {
        throw new Error('Transaction ID missing. Please request OTP again.');
      }
      if (!otp || otp.trim().length === 0) {
        throw new Error('Please enter the OTP you received.');
      }

      const payload = {
        reference_id, // reuse same reference_id
        consent: true,
        purpose: 'for bank account verification',
        initiation_transaction_id, // the generate-response txn id
        otp: otp.trim(),
        share_code: '1111',
        generate_pdf: true,
        generate_xml: true,
      };

      const res = await fetch(`${import.meta.env.VITE_BASE_URL}/proxy/validate-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error('validate-otp error', data);
        throw new Error(data?.message || data?.responseKey || 'Failed to validate OTP');
      }

      console.log('Validation Response:', data);
      onOtpValidated?.(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Invalid OTP or validation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    // optional: allow resending — generate a fresh reference_id and clear stored txn id
    localStorage.removeItem('decentroTxnId');
    localStorage.removeItem('reference_id');
    setOtp('');
    setOtpSent(false);
    setError(null);
  };

  return (
    <div>
      {!otpSent ? (
        <>
          <label className="block text-sm font-medium text-gray-700">Aadhaar Number</label>
          <input
            type="text"
            name="aadhaarNumber"
            value={formData.aadhaarNumber}
            onChange={onChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            placeholder="Enter Aadhaar Number"
          />
          <button
            onClick={handleSendOtp}
            disabled={loading}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-600"
          >
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </>
      ) : (
        <>
          <label className="block text-sm font-medium text-gray-700">Enter OTP</label>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            placeholder="Enter OTP"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleValidateOtp}
              disabled={loading}
              className="bg-green-500 text-white px-4 py-2 rounded-lg shadow hover:bg-green-600"
            >
              {loading ? 'Validating...' : 'Validate OTP'}
            </button>

            <button
              onClick={handleResend}
              disabled={loading}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg shadow hover:bg-yellow-600"
            >
              Resend / Start Over
            </button>
          </div>
        </>
      )}

      {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
    </div>
  );
}
