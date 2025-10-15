import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import PhoneVerifyModal from '../components/PhoneVerifyModal';

export default function VerifyEmail() {
  const [verifying, setVerifying] = useState(true);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneToVerify, setPhoneToVerify] = useState<string | null>(null);
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const response = await axios.get(`/api/auth/verify-email/${token}`);
        toast.success('Email verified successfully');

        // Auto-login the user if backend returned a token (keeps previous behavior)
        if (response.data.token) {
          // response.data.user is passed to login in your original code; keep that.
          login(response.data.token, response.data.user);

          // If backend returned user object, check phoneVerified flag
          const user = response.data.user;
          if (user) {
            // If phone is not verified, open the phone verification modal.
            if (user.phoneVerified !== true) {
              // If there's a phone number returned, prefill it for user convenience.
              if (user.phone) {
                setPhoneToVerify(user.phone);
              }
              setShowPhoneModal(true);
              // do not navigate away yet — let user verify phone
              return;
            } else {
              // phone already verified — proceed to home
              navigate('/');
              return;
            }
          }

          // If backend didn't return user object, fallback to navigating home
          navigate('/');
        } else {
          // If no token returned, act like before (failed to login) — send to login
          toast.error('Could not log you in automatically. Please login manually.');
          navigate('/login');
        }
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Verification failed');
        navigate('/login');
      } finally {
        setVerifying(false);
      }
    };

    verifyEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, navigate, login]);

  // Called when PhoneVerifyModal reports success
  const handleVerified = () => {
    setShowPhoneModal(false);
    toast.success('Phone number verified — redirecting...');
    navigate('/');
  };

  // Called when user closes the modal without verifying
  const handleCloseModal = () => {
    setShowPhoneModal(false);
    // You can decide where to send the user if they skip phone verification.
    // To keep UX simple, send them to home (they are logged in). If you prefer
    // to keep them on this page or take another action, change the line below.
    navigate('/');
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Verifying your email...
            </h2>
          </div>
        </div>
      </div>
    );
  }

  // When not verifying, render nothing except the modal if needed.
  return (
    <>
      {showPhoneModal && (
        <PhoneVerifyModal
          open={showPhoneModal}
          onClose={handleCloseModal}
          onVerified={handleVerified}
          // If your PhoneVerifyModal accepts a prefilled phone prop you can pass it:
          // phone={phoneToVerify || undefined}
        />
      )}
      {/* keep the page blank otherwise — or you can show a small message */}
    </>
  );
}
