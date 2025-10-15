import React, { useState } from 'react';
import { Bell, Shield, Save, Moon, Sun } from 'lucide-react';

interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
}

interface AccountSettings {
  twoFactor: boolean;
  privacyMode: boolean;
}

export function Settings() {
  const [darkMode, setDarkMode] = useState(false); // State to toggle dark mode
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    email: true,
    sms: true,
    push: false,
  });

  const [account, setAccount] = useState<AccountSettings>({
    twoFactor: false,
    privacyMode: false,
  });

  const handleSaveSettings = () => {
    console.log('Saving settings:', { notifications, account });
  };

  return (
    <div className={`${darkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          </div>

          {/* Notification Preferences */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center mb-4">
              <Bell className="h-5 w-5 text-gray-400 dark:text-gray-300 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Notification Preferences</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-gray-700 dark:text-gray-300">Email Notifications</label>
                <button
                  onClick={() => setNotifications((prev) => ({ ...prev, email: !prev.email }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications.email ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications.email ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-gray-700 dark:text-gray-300">SMS Notifications</label>
                <button
                  onClick={() => setNotifications((prev) => ({ ...prev, sms: !prev.sms }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications.sms ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications.sms ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-gray-700 dark:text-gray-300">Push Notifications</label>
                <button
                  onClick={() => setNotifications((prev) => ({ ...prev, push: !prev.push }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications.push ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications.push ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Account Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center mb-4">
              <Shield className="h-5 w-5 text-gray-400 dark:text-gray-300 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Account Settings</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-gray-700 dark:text-gray-300">Two-Factor Authentication</label>
                <button
                  onClick={() => setAccount((prev) => ({ ...prev, twoFactor: !prev.twoFactor }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    account.twoFactor ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      account.twoFactor ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-gray-700 dark:text-gray-300">Privacy Mode</label>
                <button
                  onClick={() => setAccount((prev) => ({ ...prev, privacyMode: !prev.privacyMode }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    account.privacyMode ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      account.privacyMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
