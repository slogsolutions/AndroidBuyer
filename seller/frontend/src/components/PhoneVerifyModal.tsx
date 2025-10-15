import React, { useState, useEffect } from 'react';
import { authService } from '../services/auth.service';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

export default function PhoneVerifyModal({ open, onClose }: { open: boolean; onClose: ()=>void }) {
  const [step, setStep] = useState<'enter'|'code'>('enter');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { user, setUser } = useAuth();

  useEffect(() => {
    if (open) {
      setIsVisible(true);
    } else {
      setTimeout(() => setIsVisible(false), 300);
    }
  }, [open]);

  if (!open && !isVisible) return null;

  const sendOtp = async () => {
    if (phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    
    setLoading(true);
    try {
      await authService.sendPhoneOtp(`+91${phone}`);
      toast.success('OTP sent to +91 ' + phone);
      setStep('code');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    setLoading(true);
    try {
      await authService.verifyPhoneOtp(`+91${phone}`, code);
      toast.success('Phone verified!');
      if (user) {
        setUser({ ...user, phone: `+91${phone}`, phoneVerified: true });
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid code');
    } finally { setLoading(false); }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(value);
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center z-50 transition-all duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}>
      <div 
        className={`absolute inset-0 bg-gradient-to-br from-purple-900/60 via-blue-900/50 to-indigo-900/70 backdrop-blur-sm transition-all duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} 
        onClick={onClose}
      ></div>
      
      <div className={`relative transform transition-all duration-500 ${open ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 -translate-y-4'}`}>
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-8 z-50 w-96 shadow-2xl border border-gray-200/60 relative overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-r from-indigo-400/20 to-cyan-400/20 rounded-full"></div>
          
          <div className="relative z-10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Verify Your Phone</h3>
              <p className="text-gray-500 text-sm mt-2">Secure your account with phone verification</p>
            </div>

            {step === 'enter' ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center">
                      <span className="text-gray-700 font-medium mr-1">+91</span>
                      <div className="w-px h-4 bg-gray-300 mr-3"></div>
                    </div>
                    <input 
                      value={phone} 
                      onChange={handlePhoneChange}
                      className="w-full p-4 border border-gray-300 rounded-xl bg-white/80 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm pl-20"
                      placeholder="Enter 10 digit number" 
                      type="tel"
                      maxLength={10}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">We'll send a verification code to your number</p>
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button 
                    className="flex-1 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 active:scale-95 shadow-sm"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button 
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200 active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    onClick={sendOtp} 
                    disabled={loading || phone.length !== 10}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </>
                    ) : (
                      'Send OTP'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Verification Code</label>
                  <div className="relative">
                    <input 
                      value={code} 
                      onChange={(e)=>setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full p-4 border border-gray-300 rounded-xl bg-white/80 backdrop-blur-sm focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 shadow-sm text-center text-lg font-semibold tracking-widest"
                      placeholder="Enter 6-digit code" 
                      maxLength={6}
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">Enter the 6-digit code sent to +91 {phone}</p>
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button 
                    className="flex-1 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 active:scale-95 shadow-sm"
                    onClick={()=>setStep('enter')}
                  >
                    Back
                  </button>
                  <button 
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium hover:from-green-600 hover:to-emerald-700 transition-all duration-200 active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    onClick={verifyOtp} 
                    disabled={loading || code.length !== 6}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Verifying...
                      </>
                    ) : (
                      'Verify'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
