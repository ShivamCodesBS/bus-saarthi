import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Calendar, AlertOctagon, Zap, MapPin, Search } from 'lucide-react';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';

export default function AdminSpeedAnalytics() {
  const { routeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, [routeId, date]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/telemetry/history/${routeId}?date=${date}`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      // Handle NestJS direct response vs axios wrapping
      setData(res.data?.data ? res.data : res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load telemetry history');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Format chart time
  const formatXAxis = (tickItem) => {
    const d = new Date(tickItem);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-xl">
          <p className="font-bold text-slate-800 dark:text-slate-100 mb-2">
            {new Date(label).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <p className="text-orange-500 font-bold m-0 flex items-center gap-2">
            <Activity size={16} /> Speed: {payload[0].value} km/h
          </p>
          {data?.speedLimit && payload[0].value > data.speedLimit && (
            <p className="text-red-500 text-xs font-bold mt-2 m-0 bg-red-50 dark:bg-red-900/30 p-1 rounded">
              ⚠️ OVERSPEEDING
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col pb-24">
      {/* Header */}
      <header className="p-4 sm:p-6 bg-white dark:bg-slate-900 shadow-sm sticky top-0 z-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin-dashboard')}
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border-none"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 m-0 flex items-center gap-2">
              Route {routeId} <span className="text-orange-500">Analytics</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 m-0 mt-1">Historical Speed & Violations Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="pl-3 text-slate-500"><Calendar size={20} /></div>
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent border-none outline-none font-bold text-slate-700 dark:text-slate-200 p-2 cursor-pointer w-full"
            max={new Date().toISOString().split('T')[0]}
          />
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-7xl mx-auto w-full flex-1 flex flex-col gap-6">
        
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-bold animate-pulse">Analyzing Telemetry Data...</p>
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Search size={48} className="text-slate-300 dark:text-slate-700 mb-4" />
            <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 m-0">No Telemetry Data Found</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">There is no recorded speed data for this route on {date}.</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4 transition-transform hover:-translate-y-1 duration-300">
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-2xl text-blue-600 dark:text-blue-400 shrink-0">
                  <Activity size={32} />
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider m-0">Avg Speed</p>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 m-0 mt-1">{data.stats.avgSpeed} <span className="text-lg font-bold text-slate-400">km/h</span></h2>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4 transition-transform hover:-translate-y-1 duration-300">
                <div className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-2xl text-orange-500 shrink-0">
                  <Zap size={32} />
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider m-0">Max Speed</p>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 m-0 mt-1">{data.stats.maxSpeed} <span className="text-lg font-bold text-slate-400">km/h</span></h2>
                </div>
              </div>

              <div className={`p-6 rounded-3xl shadow-sm border flex items-center gap-4 transition-transform hover:-translate-y-1 duration-300 ${data.stats.violations > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50' : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/50'}`}>
                <div className={`${data.stats.violations > 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400'} p-4 rounded-2xl shrink-0`}>
                  <AlertOctagon size={32} />
                </div>
                <div>
                  <p className={`${data.stats.violations > 0 ? 'text-red-500' : 'text-green-600'} text-sm font-bold uppercase tracking-wider m-0`}>Overspeed Violations</p>
                  <h2 className={`text-3xl font-black m-0 mt-1 ${data.stats.violations > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-500'}`}>
                    {data.stats.violations}
                  </h2>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-6 w-full relative z-10">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 m-0">Speed Timeline</h2>
                  <p className="text-sm text-slate-500 m-0 mt-1">Downsampled daily speed trajectory</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Limit: <span className="text-red-500">{data.speedLimit} km/h</span>
                </div>
              </div>
              
              <div className="h-[400px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.data}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150, 150, 150, 0.2)" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={formatXAxis} 
                      stroke="rgba(150, 150, 150, 0.5)"
                      tick={{ fill: 'rgba(150, 150, 150, 0.8)', fontSize: 12, fontWeight: 600 }}
                      minTickGap={30}
                    />
                    <YAxis 
                      stroke="rgba(150, 150, 150, 0.5)"
                      tick={{ fill: 'rgba(150, 150, 150, 0.8)', fontSize: 12, fontWeight: 600 }}
                      domain={[0, data.stats.maxSpeed > data.speedLimit + 20 ? 'auto' : data.speedLimit + 20]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine 
                      y={data.speedLimit} 
                      label={{ position: 'top', value: `LIMIT (${data.speedLimit} km/h)`, fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }} 
                      stroke="#ef4444" 
                      strokeDasharray="4 4" 
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="speed" 
                      stroke="#f97316" 
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Violations Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 m-0 flex items-center gap-2">
                  <AlertOctagon className="text-red-500" />
                  Violations Log
                </h2>
                <span className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-bold px-3 py-1 rounded-full text-sm">
                  {data.violationsData?.length || 0} Incidents
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <th className="p-4 font-bold">Time</th>
                      <th className="p-4 font-bold">Speed Recorded</th>
                      <th className="p-4 font-bold">Location</th>
                      <th className="p-4 font-bold">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!data.violationsData || data.violationsData.length === 0) ? (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">
                          No overspeeding violations recorded today! 🎉
                        </td>
                      </tr>
                    ) : (
                      data.violationsData.map((v, i) => {
                        const excess = v.speed - data.speedLimit;
                        let severity = 'Low';
                        let badgeColor = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
                        if (excess >= 20) {
                          severity = 'Critical';
                          badgeColor = 'bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-400 animate-pulse';
                        } else if (excess >= 10) {
                          severity = 'High';
                          badgeColor = 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400';
                        }
                        
                        return (
                          <tr key={i} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                              {new Date(v.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="p-4">
                              <span className="font-black text-red-600 dark:text-red-400 text-lg">{Math.round(v.speed)}</span> 
                              <span className="text-xs text-slate-500 ml-1">km/h</span>
                            </td>
                            <td className="p-4">
                              <a 
                                href={`https://maps.google.com/?q=${v.latitude},${v.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-blue-500 hover:text-blue-600 font-semibold text-sm no-underline"
                              >
                                <MapPin size={16} /> View on Map
                              </a>
                            </td>
                            <td className="p-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${badgeColor}`}>
                                {severity}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
