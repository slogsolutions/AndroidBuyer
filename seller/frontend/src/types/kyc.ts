export interface KYCFormData {
  fullName: string;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  idType: 'passport' | 'drivingLicense' | 'nationalId';
  idNumber: string;
  phoneNumber: string;
}

export interface KYCState {
  step: number;
  loading: boolean;
  error: string | null;
  success: boolean;
}