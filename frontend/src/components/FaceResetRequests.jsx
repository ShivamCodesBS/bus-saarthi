import { useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Fingerprint, Check, Phone, MapPin } from 'lucide-react';
import { BACKEND_URL } from '../config';
import { friendlyError } from '../lib/errors';
import { useStaleWhileRevalidate } from '../hooks/useStaleWhileRevalidate';

/**
 * Face reset requests raised from the passenger/staff Settings page.
 * Shown in the admin and transport-incharge Users tabs so the request
 * arrives with the requester's details and can be approved in one click.
 */
const FaceResetRequests = ({ user, onChanged }) => {
  const [busyId, setBusyId] = useState(null);

  const { data, isLoading, refetch } = useStaleWhileRevalidate('/api/users/face-reset-requests', {
    cacheKey: 'staff:face-reset-requests',
    staleTime: 30000,
    token: user?.token,
  });

  const requests = Array.isArray(data) ? data : [];

  const handleApprove = useCallback(async (loginId) => {
    setBusyId(loginId);
    try {
      await axios.post(
        `${BACKEND_URL}/api/users/${loginId}/face-reset/approve`,
        {},
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      toast.success(`Face reset approved for ${loginId}. They can now re-enroll.`);
      await refetch();
      if (onChanged) onChanged();
    } catch (err) {
      toast.error(friendlyError(err, 'Failed to approve face reset'));
    } finally {
      setBusyId(null);
    }
  }, [user?.token, refetch, onChanged]);

  if (isLoading && requests.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200 dark:border-amber-800">
        <Fingerprint size={18} className="text-amber-600" />
        <h3 className="m-0 font-bold text-amber-800 dark:text-amber-300 text-sm">
          Face Reset Requests {requests.length > 0 && `(${requests.length})`}
        </h3>
      </div>

      {requests.length === 0 ? (
        <p className="m-0 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          No pending face reset requests.
        </p>
      ) : (
        <div className="flex flex-col">
          {requests.map((r) => (
            <div
              key={r.login_id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-amber-100 dark:border-amber-900/50 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="m-0 font-bold text-slate-800 dark:text-slate-100 text-sm">
                  {r.name} <span className="font-mono text-xs text-slate-500">({r.login_id})</span>
                </p>
                <p className="m-0 mt-0.5 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="capitalize">{String(r.role || '').replace('_', ' ')}</span>
                  {r.route_name && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} /> {r.route_name}{r.bus_number ? ` · Bus ${r.bus_number}` : ''}
                    </span>
                  )}
                  {r.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={11} /> {r.phone}
                    </span>
                  )}
                  <span>
                    Requested {r.requested_at ? new Date(r.requested_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                  </span>
                </p>
              </div>
              <button
                onClick={() => handleApprove(r.login_id)}
                disabled={busyId === r.login_id}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white border-none py-2 px-4 rounded-xl font-bold text-xs cursor-pointer transition-colors"
              >
                <Check size={14} /> {busyId === r.login_id ? 'Approving…' : 'Approve Reset'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FaceResetRequests;
