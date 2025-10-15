import React, { createContext, useContext, useState } from 'react';

interface KYCContextProps {
  formData: KYCFormData;
  setFormData: React.Dispatch<React.SetStateAction<KYCFormData>>;
  otpVerified: boolean;
  setOtpVerified: React.Dispatch<React.SetStateAction<boolean>>;
  kycStatus: string | null;
  setKycStatus: React.Dispatch<React.SetStateAction<string | null>>;
}

const KYCContext = createContext<KYCContextProps | undefined>(undefined);

export const KYCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [formData, setFormData] = useState<KYCFormData>({
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
  });
  const [otpVerified, setOtpVerified] = useState(false);
  const [kycStatus, setKycStatus] = useState<string | null>(null);

  return (
    <KYCContext.Provider value={{ formData, setFormData, otpVerified, setOtpVerified, kycStatus, setKycStatus }}>
      {children}
    </KYCContext.Provider>
  );
};

export const useKYC = (): KYCContextProps => {
  const context = useContext(KYCContext);
  if (!context) {
    throw new Error('useKYC must be used within a KYCProvider');
  }
  return context;
};
