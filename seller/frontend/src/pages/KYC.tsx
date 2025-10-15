import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import PersonalInfoForm from '../components/kyc/PersonalInfoForm';
import AddressForm from '../components/kyc/AddressForm';
import IdentificationForm from '../components/kyc/IdentificationForm';
import type { KYCFormData, KYCState } from '@/types/kyc';
import LoadingScreen from './LoadingScreen';

const initialFormData: KYCFormData = {
  fullName: '',
  dateOfBirth: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  idType: 'passport',
  idNumber: '',
  phoneNumber: '',
};

export default function KYC() {
  const [formData, setFormData] = useState<KYCFormData>(initialFormData);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [loadingKycStatus, setLoadingKycStatus] = useState(true);
  const [state, setState] = useState<KYCState>({
    step: 1,
    loading: false,
    error: null,
    success: false,
  });
  const [otpVerified, setOtpVerified] = useState(false);
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const totalSteps = 3;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // If the global user becomes approved at any time, redirect to register-parking
  useEffect(() => {
    if (user?.kycStatus === 'approved') {
      navigate('/register-parking');
    }
  }, [user, navigate]);

  // fetchKycStatus defined outside effect so we can call it after refreshUser
  const fetchKycStatus = async () => {
    try {
      setLoadingKycStatus(true);
      const response = await fetch(`${import.meta.env.VITE_BASE_URL}/api/kyc/status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch KYC status');

      const data = await response.json();
      // debug
      console.log("Fetched KYC Status:", data);
      setKycStatus(data.status);

      if (data.status === 'submitted') {
        setState((prev) => ({ ...prev, success: true, step: totalSteps }));
      } else if (data.status === 'approved') {
        setState((prev) => ({ ...prev, success: true, step: totalSteps + 1 }));

        // refresh global user so navbar & other screens get updated kycStatus immediately
        try {
          await refreshUser();
        } catch (refreshErr) {
          // log but do not block navigation
          // eslint-disable-next-line no-console
          console.warn('refreshUser failed after KYC status fetch:', refreshErr);
        }

        // Navigate to register immediately
        navigate('/register-parking');
      }
    } catch (error) {
      console.error(error);
      setState((prev) => ({ ...prev, error: 'Failed to fetch KYC status' }));
    } finally {
      setLoadingKycStatus(false);
    }
  };

  // On mount: first refresh the global user (in case login just happened),
  // then fetch the KYC status. The separate user-based effect above will also redirect
  // if refreshUser loaded an approved user.
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        // Try to refresh global user so UI reflects latest server state immediately
        await refreshUser();
      } catch (err) {
        // not fatal; we still proceed to fetch KYC status
        // eslint-disable-next-line no-console
        console.warn('refreshUser failed on KYC mount:', err);
      }

      // If after refresh the user is already approved, the other effect will redirect.
      // Still fetch the KYC status for local UI state and fallback navigation.
      if (mounted) {
        await fetchKycStatus();
      }
    };

    init();

    return () => {
      mounted = false;
    };
    // we intentionally run this only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (state.step < totalSteps) {
      setState((prev) => ({ ...prev, step: prev.step + 1 }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch(`${import.meta.env.VITE_BASE_URL}/api/kyc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ ...formData, kycStatus: 'approved' }),
      });

      const data = await response.json();
      console.log('KYC submit response:', data);

      if (!response.ok) {
        const msg = data?.message || 'Failed to submit KYC';
        throw new Error(msg);
      }

      // Update local kycStatus for immediate UI feedback
      setKycStatus(data.status || 'approved');

      // refresh global user so navbar & other screens get updated kycStatus
      try {
        await refreshUser();
      } catch (refreshErr) {
        // log but do not block the flow
        // eslint-disable-next-line no-console
        console.warn('refreshUser failed after KYC submit:', refreshErr);
      }

      toast.success('KYC submitted successfully!');

      // Navigate directly to register-parking so provider can register location immediately
      navigate('/register-parking');
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        error: error.message || 'Failed to submit KYC',
      }));
      toast.error(error.message || 'Failed to submit KYC');
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleBack = () => {
    setState((prev) => ({ ...prev, step: prev.step - 1 }));
  };

  const handleOtpValidated = (data: any) => {
    setOtpVerified(true);
    const { proofOfIdentity, proofOfAddress } = data.data;
    setFormData((prev) => ({
      ...prev,
      fullName: proofOfIdentity.name,
      dateOfBirth: proofOfIdentity.dob,
      phoneNumber: proofOfIdentity.mobileNumber,
      address: proofOfAddress.vtc + " " + proofOfAddress.subDistrict,
      city: proofOfAddress.district,
      state: proofOfAddress.state,
      zipCode: proofOfAddress.pincode,
      country: proofOfAddress.country,
    }));
    setState((prev) => ({ ...prev, step: prev.step + 1 }));
  };

  const renderStep = () => {
    if (state.step === 1) {
      return (
        <IdentificationForm
          formData={{ aadhaarNumber: formData.idNumber }}
          onChange={(e) => handleChange({ target: { name: 'idNumber', value: e.target.value } })}
          onOtpSent={() => toast.info('OTP sent successfully!')}
          onOtpValidated={handleOtpValidated}
        />
      );
    }

    if (!otpVerified) {
      return (
        <div className="text-center text-red-500">
          <p>Please complete OTP verification before proceeding.</p>
        </div>
      );
    }

    switch (state.step) {
      case 2:
        return <PersonalInfoForm formData={formData} onChange={handleChange} />;
      case 3:
        return <AddressForm formData={formData} onChange={handleChange} />;
      default:
        return null;
    }
  };

  if (loadingKycStatus) {
    return <div className="h-[calc(100vh-64px)] flex items-center justify-center"> 
      <LoadingScreen/>
    </div>;
  }

  const renderKycStatus = () => {
    if (!kycStatus) return null;

    if (kycStatus === 'submitted' || kycStatus === 'approved') {
      return (
        <div className="mt-8 text-center bg-green-50 border-l-4 border-red-400 text-red-700 p-4">
          <h3 className="text-xl font-semibold">KYC Approved</h3>
          <p>Your KYC has been approved! You can now register your location.</p>
          <button
            onClick={() => navigate('/register-parking')}
            className="mt-4 bg-gradient-to-r from-red-500 to-red-500 text-white px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transform transition-transform hover:scale-105"
          >
            Register Location
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-50 py-12">
      <div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-10">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-800">Complete Your KYC</h2>
            <p className="mt-2 text-sm text-gray-500">
              Step {Math.min(state.step, totalSteps)} of {totalSteps}
            </p>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div
                style={{ width: `${(Math.min(state.step, totalSteps) / totalSteps) * 100}%` }}
                className="bg-gradient-to-r from-red-400 to-red-600 h-2 rounded-full"
              />
            </div>
          </div>

          {state.success || kycStatus === 'submitted' || kycStatus === 'approved' ? (
            renderKycStatus()
          ) : (

          <form onSubmit={handleSubmit}>
            <div className="space-y-6">{renderStep()}</div>
            <div className="mt-8 flex justify-between">
              {state.step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 focus:outline-none"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={state.loading || (state.step === 1 && !otpVerified)}
                className={`ml-auto ${
                  state.step === 1 && !otpVerified
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                } px-6 py-2 rounded-lg shadow-md hover:shadow-lg transform transition-transform hover:scale-105`}
              >
                {state.loading ? 'Processing...' : state.step === totalSteps ? 'Submit' : 'Next'}
              </button>
            </div>
          </form>
          )}
          
        </div>
      </div>
    </div>
  );
}
