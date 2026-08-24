import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ScrollText, ShieldAlert, LogOut, Menu, X, Server, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Layout({ setAuthToken }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('tech_admin_token');
    setAuthToken(null);
    navigate('/login');
  };

  const navLinks = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/logs", icon: ScrollText, label: "System Logs" }
  ];

  const SidebarContent = () => (
    <>
      <div className="h-20 flex items-center px-6 border-b border-slate-100 font-extrabold text-2xl tracking-tight text-slate-800">
        <div className="bg-blue-600 p-2 rounded-xl mr-3 shadow-lg shadow-blue-500/20">
          <ShieldAlert className="w-6 h-6 text-white" />
        </div>
        Bus <span className="text-orange-500 ml-1">Admin</span>
      </div>
      <nav className="flex-1 py-6 px-4 space-y-2">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center px-4 py-3.5 rounded-2xl transition-all font-semibold ${
                isActive 
                  ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`
            }
          >
            <link.icon className="w-5 h-5 mr-3" />
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-100">
        <Button 
          variant="ghost" 
          onClick={handleLogout} 
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 font-bold rounded-xl"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Secure Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans relative">
      
      {/* Floating Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[40%] h-[40%] rounded-full bg-blue-200/40 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-200/40 blur-[150px]" />
        <div className="absolute top-[40%] left-[-10%] w-[30%] h-[30%] rounded-full bg-orange-200/30 blur-[100px]" />
        <div className="absolute top-1/4 right-1/4 animate-bounce duration-[3000ms] opacity-[0.03]"><Server size={120} /></div>
        <div className="absolute bottom-1/4 left-1/3 animate-pulse opacity-[0.03]"><Activity size={150} /></div>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden absolute top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200 z-50 flex items-center justify-between px-4">
        <div className="font-extrabold text-xl text-slate-800 flex items-center">
          <ShieldAlert className="w-6 h-6 text-blue-600 mr-2" /> Tech Admin
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 bg-white/60 backdrop-blur-2xl border-r border-slate-200 flex-col z-20 shadow-xl">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="relative w-72 max-w-[80%] bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-left">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative z-10 pt-16 lg:pt-0">
        <div className="p-4 md:p-8 min-h-full max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
