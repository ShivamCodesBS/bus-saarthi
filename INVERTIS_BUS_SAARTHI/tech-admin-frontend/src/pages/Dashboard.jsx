import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Server, Cpu, HardDrive, Clock, Activity, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard({ authToken }) {
  const [metrics, setMetrics] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authToken) return;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
    
    // Connect to websocket with token
    const socket = io(apiUrl, {
      auth: { token: authToken },
    });

    socket.on('connect', () => {
      setConnected(true);
      setError('');
      // Join admin room
      socket.emit('join_admin', { token: authToken }, (res) => {
        if(res?.event !== 'subscribed') {
          setError('Failed to join admin channel');
        }
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Connection lost or unauthorized.');
      setConnected(false);
    });

    socket.on('live_metrics', (newMetrics) => {
      setMetrics(newMetrics);
      
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      setChartData(prev => {
        const newData = [...prev, {
          time: timeStr,
          cpu: newMetrics.cpu?.loadAverage[0] || 0,
          ram: parseFloat(newMetrics.memory?.usagePercentage) || 0,
        }];
        // Keep last 20 data points
        if (newData.length > 20) return newData.slice(newData.length - 20);
        return newData;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [authToken]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <div className="bg-red-50 text-red-600 p-8 rounded-3xl flex flex-col items-center border border-red-100 shadow-xl">
          <AlertTriangle className="w-16 h-16 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connection Error</h2>
          <p className="font-medium text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!connected && !metrics) {
    return (
      <div className="flex items-center justify-center h-[70vh] text-blue-600">
        <Activity className="animate-spin w-10 h-10 mr-4" />
        <span className="text-xl font-bold tracking-tight">Connecting to Live Telemetry...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Dashboard</h1>
          <p className="text-slate-500 mt-1 font-medium">Real-time overview of backend services.</p>
        </div>
        <div className="flex items-center px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200">
          <span className={`w-3 h-3 rounded-full mr-2 ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
          <span className="text-sm font-bold text-slate-700">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          icon={<Cpu className="w-8 h-8 text-blue-600" />}
          title="CPU Usage"
          value={metrics?.cpu ? `${metrics.cpu.loadAverage[0].toFixed(2)}%` : '0%'}
          subtext={metrics?.cpu ? `${metrics.cpu.cores} Cores - ${metrics.cpu.model.substring(0, 15)}...` : 'Waiting...'}
          bgClass="bg-blue-50"
        />
        <MetricCard 
          icon={<HardDrive className="w-8 h-8 text-emerald-600" />}
          title="Memory Usage"
          value={metrics?.memory ? `${metrics.memory.usagePercentage}%` : '0%'}
          subtext={metrics?.memory ? `${(metrics.memory.used / 1024 / 1024 / 1024).toFixed(1)} GB / ${(metrics.memory.total / 1024 / 1024 / 1024).toFixed(1)} GB` : 'Waiting...'}
          bgClass="bg-emerald-50"
        />
        <MetricCard 
          icon={<Server className="w-8 h-8 text-violet-600" />}
          title="Server Status"
          value={connected ? "Healthy" : "Offline"}
          subtext="Socket.io Connection"
          status={connected ? "good" : "bad"}
          bgClass="bg-violet-50"
        />
        <MetricCard 
          icon={<Clock className="w-8 h-8 text-orange-600" />}
          title="Process Uptime"
          value={formatUptime(metrics?.process?.uptime)}
          subtext="Since last restart"
          bgClass="bg-orange-50"
        />
      </div>

      {/* Chart Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Resource Utilization</h2>
          <div className="flex items-center text-sm font-bold space-x-6">
             <div className="flex items-center"><span className="w-4 h-4 rounded-full bg-blue-500 mr-2 shadow-sm shadow-blue-500/50"></span> CPU Load</div>
             <div className="flex items-center"><span className="w-4 h-4 rounded-full bg-emerald-500 mr-2 shadow-sm shadow-emerald-500/50"></span> RAM Usage</div>
          </div>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="time" stroke="#64748b" fontSize={12} fontWeight={600} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} fontWeight={600} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
              />
              <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCpu)" strokeWidth={3} isAnimationActive={false} />
              <Area type="monotone" dataKey="ram" stroke="#10b981" fillOpacity={1} fill="url(#colorRam)" strokeWidth={3} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, title, value, subtext, status, bgClass }) {
  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xl shadow-slate-200/50 relative overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
      <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full ${bgClass} opacity-50 group-hover:scale-150 transition-transform duration-500`} />
      
      <div className="flex items-center space-x-4 mb-4 relative z-10">
        <div className={`p-3 rounded-2xl ${bgClass} shadow-inner`}>
          {icon}
        </div>
        <div>
          <p className="text-slate-500 font-bold text-sm uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight flex items-center">
            {value}
            {status === 'good' && <span className="ml-3 w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50"></span>}
            {status === 'bad' && <span className="ml-3 w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50"></span>}
          </h3>
        </div>
      </div>
      <p className="text-sm font-semibold text-slate-400 relative z-10">{subtext}</p>
    </div>
  )
}

function formatUptime(seconds) {
  if (!seconds) return '0h 0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
