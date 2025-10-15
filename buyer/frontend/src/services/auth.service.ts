import api from '../utils/api';

export const authService = {
  async login(email: string, password: string) {
    const response = await api.post('auth/login', { email, password });
    return response.data;
  },

  async register(name: string, email: string, password: string) {
    const response = await api.post('auth/register', { name, email, password });
return { ...(response.data || {}), status: response.status };

  },

  async googleLogin(credential: string) {
    const response = await api.post('auth/google', { credential });
    return response.data;
  },

  async forgotPassword(email: string) {
    const response = await api.post('auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(token: string, password: string) {
    const response = await api.post(`auth/reset-password/${token}`, { password });
    return response.data;
  },

  async verifyEmail(token: string) {
    const response = await api.get(`auth/verify-email/${token}`);
    return response.data;
  },

  async getMe() {
    const response = await api.get('auth/me');
    return response.data;
  },

  async setOnline(online: boolean) {
    const response = await api.patch('auth/online', { online });
    return response.data;
  },

  // ---- Phone OTP methods ----
  // Sends an OTP to the provided phone number (expects authenticated user)
  async sendPhoneOtp(phone: string) {
    const response = await api.post('auth/send-phone-otp', { phone });
    return response.data;
  },

  // Verifies the OTP code for the provided phone (expects authenticated user)
  async verifyPhoneOtp(phone: string, code: string) {
    const response = await api.post('auth/verify-phone-otp', { phone, code });
    return response.data;
  },
};
