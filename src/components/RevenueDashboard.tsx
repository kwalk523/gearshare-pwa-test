import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, TrendingUp, Package, Clock, Shield, CheckCircle, Receipt, ArrowRightCircle } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { useRevenue } from '../hooks/useRevenue';
import { usePayouts } from '../hooks/usePayouts';

export default function RevenueDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const { stats, loading, refresh } = useRevenue(user?.id);
  const { pendingAmount, payouts, loading: payoutsLoading, creating, error: payoutError, createPayout, refresh: refreshPayouts } = usePayouts(user?.id);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (data && data.user) {
        setUser(data.user);
      }
    }
    loadUser();
  }, []);

  const handleManualRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    refresh();
    refreshPayouts();
  };

  if (loading || payoutsLoading) {
    return <div className="py-16 text-center text-emerald-600 animate-pulse">Loading earnings & payouts...</div>;
  }

  if (!user || !stats) {
    return <div className="p-8 text-center text-lg text-gray-500">Please log in to view earnings.</div>;
  }

  const StatCard = ({ 
    icon: Icon, 
    title, 
    value, 
    subtitle, 
    color = 'emerald' 
  }: { 
  icon: React.ComponentType<{ className?: string }>;
    title: string; 
    value: string; 
    subtitle?: string; 
    color?: 'emerald' | 'blue' | 'orange' | 'purple' 
  }) => {
    const colorClasses = {
      emerald: 'from-emerald-50 to-emerald-100 text-emerald-600',
      blue: 'from-blue-50 to-blue-100 text-blue-600',
      orange: 'from-orange-50 to-orange-100 text-orange-600',
      purple: 'from-purple-50 to-purple-100 text-purple-600',
    };

    return (
      <div className="card card-lift p-6">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-1">{value}</h3>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="mb-2">Earnings Dashboard</h1>
          <p className="text-gray-600">Track your rental income and performance</p>
        </div>
        <button
          onClick={handleManualRefresh}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={DollarSign}
          title="Total Earnings"
          value={`$${stats.totalEarnings.toFixed(2)}`}
          subtitle="From completed rentals"
          color="emerald"
        />
        <StatCard
          icon={Clock}
          title="Active Rental Value"
          value={`$${stats.pendingPayouts.toFixed(2)}`}
          subtitle="Projected earnings in progress"
          color="blue"
        />
        <StatCard
          icon={Receipt}
          title="Unpaid Completed Earnings"
          value={`$${pendingAmount.toFixed(2)}`}
          subtitle="Ready to generate payout"
          color="purple"
        />
        <StatCard
          icon={CheckCircle}
          title="Completed Rentals"
          value={stats.completedRentals.toString()}
          subtitle={`Avg: $${stats.averageRentalValue.toFixed(2)}`}
          color="emerald"
        />
        <StatCard
          icon={Package}
          title="Active Rentals"
          value={stats.activeRentals.toString()}
          subtitle="Currently rented out"
          color="orange"
        />
      </div>

      {/* Deposit Overview */}
      <div className="card p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Deposit Overview</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-blue-600 font-medium mb-1">Held in Escrow</p>
            <p className="text-2xl font-bold text-blue-700">${stats.depositsHeld.toFixed(2)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <p className="text-sm text-green-600 font-medium mb-1">Released</p>
            <p className="text-2xl font-bold text-green-700">${stats.depositsReleased.toFixed(2)}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <p className="text-sm text-orange-600 font-medium mb-1">Charged for Damage</p>
            <p className="text-2xl font-bold text-orange-700">${stats.depositsCharged.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Payouts Section */}
      <div className="card p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowRightCircle className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-semibold text-gray-900">Payouts</h2>
          </div>
          <button
            disabled={creating || pendingAmount <= 0}
            onClick={async () => { await createPayout(); refreshPayouts(); }}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {creating ? 'Generating...' : 'Generate Payout'}
          </button>
        </div>
        {payoutError && <p className="text-sm text-red-600 mb-3">{payoutError}</p>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
            <p className="text-sm text-emerald-600 font-medium mb-1">Unpaid Earnings</p>
            <p className="text-2xl font-bold text-emerald-700">${pendingAmount.toFixed(2)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-blue-600 font-medium mb-1">Pending Payouts</p>
            <p className="text-2xl font-bold text-blue-700">${payouts.filter(p => p.status === 'pending' || p.status === 'processing').reduce((s,p)=>s+p.net_amount,0).toFixed(2)}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <p className="text-sm text-purple-600 font-medium mb-1">Paid Out</p>
            <p className="text-2xl font-bold text-purple-700">${payouts.filter(p => p.status === 'paid').reduce((s,p)=>s+p.net_amount,0).toFixed(2)}</p>
          </div>
        </div>
        {payouts.length === 0 ? (
          <p className="text-center py-6 text-gray-500">No payouts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Period</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Fee</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Net</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Initiated</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map(p => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-900">{new Date(p.period_start).toLocaleDateString()} – {new Date(p.period_end).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-700">${p.total_amount.toFixed(2)}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">${p.fee_amount.toFixed(2)}</td>
                    <td className="py-3 px-4 text-sm font-semibold text-emerald-600">${p.net_amount.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        p.status === 'paid' ? 'bg-green-100 text-green-700' :
                        p.status === 'failed' ? 'bg-red-100 text-red-700' :
                        p.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">{p.initiated_at ? new Date(p.initiated_at).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Earning Gear */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-semibold text-gray-900">Top Earning Gear</h2>
          </div>
          
          {stats.topEarningGear.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No completed rentals yet</p>
          ) : (
            <div className="space-y-3">
              {stats.topEarningGear.map((gear, index) => (
                <div 
                  key={gear.gear_id} 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{gear.gear_title}</p>
                      <p className="text-xs text-gray-500">{gear.rental_count} rental{gear.rental_count > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">${gear.total_earnings.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly Earnings Chart */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Monthly Earnings</h2>
          </div>
          
          {stats.monthlyEarnings.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No earnings data yet</p>
          ) : (
            <div className="space-y-3">
              {stats.monthlyEarnings.map(({ month, earnings }) => {
                const maxEarnings = Math.max(...stats.monthlyEarnings.map(m => m.earnings));
                const widthPercent = maxEarnings > 0 ? (earnings / maxEarnings) * 100 : 0;
                
                return (
                  <div key={month} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{month}</span>
                      <span className="font-semibold text-gray-900">${earnings.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card p-6 mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Transactions</h2>
        
        {stats.recentTransactions.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No transactions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Gear</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Renter</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentTransactions.map((txn) => (
                  <tr key={txn.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-900">{txn.gear_title}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{txn.renter_name}</td>
                    <td className="py-3 px-4 text-sm font-semibold text-emerald-600">${txn.amount.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        txn.status === 'completed' ? 'bg-green-100 text-green-700' :
                        txn.status === 'active' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {txn.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(txn.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
