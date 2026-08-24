import { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Search, Filter, AlertCircle, Info, AlertTriangle, Bug, X, TerminalSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Logs({ authToken }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    if (!authToken) return;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
    
    const fetchLogs = async () => {
      try {
        const res = await axios.get(`${apiUrl}/health/logs`, { 
          headers: { Authorization: `Bearer ${authToken}` }
        });
        setLogs(res.data.data || []);
      } catch (err) {
        console.error("Failed to fetch logs", err);
        setError('Failed to fetch historical logs. Ensure backend is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();

    const socket = io(apiUrl, {
      auth: { token: authToken },
    });

    socket.on('connect', () => {
      socket.emit('join_admin', { token: authToken });
    });

    socket.on('new_log', (newLog) => {
      setLogs(prev => [newLog, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [authToken]);

  const getLevelIcon = (level) => {
    switch (level?.toLowerCase()) {
      case 'error': return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warn': return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'debug': return <Bug className="w-5 h-5 text-purple-600" />;
      default: return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getLevelBadge = (level) => {
    switch (level?.toLowerCase()) {
      case 'error': return 'bg-red-50 text-red-700 border-red-200';
      case 'warn': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'debug': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Logs</h1>
          <p className="text-slate-500 mt-1 font-medium">Trace, debug, and monitor backend events in real-time.</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search logs..." 
              className="bg-white border border-slate-200 text-slate-900 font-medium text-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 block w-64 pl-10 p-2.5 outline-none transition-all shadow-sm"
            />
          </div>
          <Button variant="outline" className="border-slate-200 text-slate-700 font-semibold rounded-xl">
            <Filter className="w-4 h-4 mr-2" /> Filter
          </Button>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-2xl border border-red-100 font-semibold flex items-center shadow-sm">
          <AlertTriangle className="w-5 h-5 mr-3" /> {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden relative z-10">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-500 uppercase font-extrabold bg-slate-50/80 backdrop-blur sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th scope="col" className="px-6 py-4">Level</th>
                <th scope="col" className="px-6 py-4">Timestamp</th>
                <th scope="col" className="px-6 py-4">Context</th>
                <th scope="col" className="px-6 py-4 w-1/2">Message</th>
                <th scope="col" className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center font-bold text-slate-400">
                    <div className="flex justify-center mb-2"><Info className="w-8 h-8 animate-pulse text-blue-500" /></div>
                    Loading secure logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center font-bold text-slate-400">
                    No logs found in the system.
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => (
                  <tr key={log.id || index} onClick={() => setSelectedLog(log)} className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">{getLevelIcon(log.level)}</div>
                        <span className={`px-2.5 py-1 text-xs font-black border rounded-md uppercase tracking-wider ${getLevelBadge(log.level)}`}>
                          {log.level}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-semibold text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">
                      {log.context || 'System'}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-medium text-slate-600 truncate max-w-md">
                      {log.message}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="text-blue-600 font-bold hover:bg-blue-50">Deep View</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deep View Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />
          <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl animate-in slide-in-from-right overflow-hidden flex flex-col border-l border-slate-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center space-x-3">
                <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                  <TerminalSquare className="w-6 h-6 text-slate-700" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Log Inspection</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedLog(null)}>
                <X className="w-6 h-6" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Severity Level</p>
                  <div className="flex items-center">
                    <span className={`px-3 py-1.5 text-sm font-black border rounded-lg uppercase tracking-wider ${getLevelBadge(selectedLog.level)}`}>
                      {selectedLog.level}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Timestamp</p>
                  <p className="font-mono text-sm font-bold text-slate-700">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message Payload</p>
                <div className="bg-slate-900 rounded-2xl p-4 overflow-x-auto shadow-inner border border-slate-800">
                  <pre className="text-emerald-400 font-mono text-sm whitespace-pre-wrap font-medium">
                    {selectedLog.message}
                  </pre>
                </div>
              </div>

              {selectedLog.meta && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Metadata & Stack Trace</p>
                  <div className="bg-slate-900 rounded-2xl p-4 overflow-x-auto shadow-inner border border-slate-800">
                    <pre className="text-blue-400 font-mono text-xs whitespace-pre-wrap font-medium">
                      {JSON.stringify(selectedLog.meta, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
