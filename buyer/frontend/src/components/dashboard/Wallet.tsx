import React from 'react';
import { 
  WalletCards,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  CreditCard,
  Receipt,
  ArrowDownToLine,
  History
} from 'lucide-react';
import type { Transaction } from '@/types';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// import { FontAwesomeIcon, FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface WalletProps {
  balance: number;
  transactions: Transaction[];
  onRequestPayout: () => void;
}

export function Wallet({ balance, transactions, onRequestPayout }: WalletProps) {
  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            {/* <WalletCards className="h-7 w-7 text-primary-500 mr-3" /> */}
            <FontAwesomeIcon icon={FontAwesomeIcon} className="h-7 w-7 text-primary-500 mr-3"/>
            Wallet
          </h2>
        </div>

        <div className="grid gap-6 mb-8 md:grid-cols-2">
          {/* Balance Card */}
          <div className="bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <CreditCard className="h-8 w-8 opacity-80" />
              <button
                onClick={onRequestPayout}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-colors duration-200 flex items-center"
              >
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                Request Payout
              </button>
            </div>
            <p className="text-white/80 mb-1">Available Balance</p>
            <p className="text-4xl font-bold">₹{balance.toFixed(2)}</p>
          </div>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center mb-4">
              {/* <Receipt className="h-5 w-5 text-primary-500 mr-2" /> */}
              <FontAwesomeIcon icon={FontAwesomeIcon} className='mr-2 text-gray-900 dark:text-white'/>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Stats</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-600 dark:text-gray-400">This Month</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">₹1,234.56</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-600 dark:text-gray-400">Last Month</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">₹987.65</p>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <History className="h-5 w-5 text-primary-500 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transaction History</h3>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
              >
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-lg ${
                    transaction.type === 'credit' 
                      ? 'bg-green-50 dark:bg-green-900/20' 
                      : 'bg-red-50 dark:bg-red-900/20'
                  }`}>
                    {transaction.type === 'credit' ? (
                      <ArrowUpCircle className="h-6 w-6 text-green-500" />
                    ) : (
                      <ArrowDownCircle className="h-6 w-6 text-red-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {transaction.description}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {transaction.timestamp.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className={`text-sm font-medium ${
                  transaction.type === 'credit' 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}