import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiShield,
  FiBriefcase,
  FiUsers,
  FiHome,
  FiArrowRight,
  FiLogIn
} from 'react-icons/fi';
import { ensureAdminAuth, loginAdmin } from '../utils/adminAuth';

const AdminAuth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkAdmin = async () => {
      const result = await ensureAdminAuth();
      if (!cancelled && result.success) {
        navigate('/admin-portal', { replace: true });
      }
    };

    checkAdmin();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleLogin = async () => {
    setLoading(true);

    try {
      const result = await loginAdmin();

      if (!result.success) {
        toast.error(result.error || 'Admin sign-in failed');
        return;
      }

      toast.success('Admin access granted');
      navigate('/admin-portal', { replace: true });
    } catch (error) {
      console.error('Admin auth error:', error);
      toast.error('Unable to sign in as admin');
    } finally {
      setLoading(false);
    }
  };

  const highlights = [
    {
      icon: FiBriefcase,
      title: 'Create supermarkets',
      text: 'Set up new stores and organize your business locations.'
    },
    {
      icon: FiUsers,
      title: 'Assign staff',
      text: 'Approve and assign managers or cashiers to stores.'
    },
    {
      icon: FiHome,
      title: 'Manage your hub',
      text: 'Keep the business setup tools in one controlled place.'
    }
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.88),_rgba(15,23,42,1)),linear-gradient(135deg,_#020617,_#0f172a_55%,_#1e293b)] text-white flex items-center justify-center px-4 py-10">
      <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            <FiShield className="text-emerald-400" />
            Admin only
          </div>

          <h1 className="text-4xl md:text-5xl font-black leading-tight">
            Business setup starts here.
          </h1>
          <p className="text-lg text-slate-300 max-w-xl">
            Sign in as admin to create supermarkets, assign staff, and control who gets manager or cashier access.
          </p>

          <div className="grid sm:grid-cols-3 gap-4">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-emerald-300" />
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-300">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[2rem] bg-white text-slate-900 shadow-2xl p-6 md:p-8 border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center">
              <FiLogIn className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Admin access</h2>
              <p className="text-sm text-slate-500">Open the admin portal to manage your supermarket network.</p>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-700 px-4 py-4 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-60"
            >
              <span className="inline-flex items-center justify-center gap-2">
                {loading ? 'Signing in...' : 'Sign in as admin'}
                <FiArrowRight />
              </span>
            </button>

            <button
              onClick={() => navigate('/customer-login')}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Back to customer login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuth;
