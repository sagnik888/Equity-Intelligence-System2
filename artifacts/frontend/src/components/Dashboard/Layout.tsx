import React, { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Search,
  Bookmark,
  Building2,
  Briefcase,
  ShoppingCart,
  Bell,
  BarChart4,
  Database,
  Settings,
  LogOut,
  Menu,
  X,
  Activity,
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  currentPage,
  onNavigate,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navigationItems = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "signals", label: "Signals", icon: TrendingUp },
    { id: "screener", label: "Screener", icon: Search },
    { id: "rankings", label: "Rankings", icon: BarChart3 },
    { id: "watchlists", label: "Watchlists", icon: Bookmark },
    { id: "company-research", label: "Company Research", icon: Building2 },
    { id: "portfolio", label: "Portfolio", icon: Briefcase },
    { id: "orders", label: "Orders", icon: ShoppingCart },
    { id: "alerts", label: "Alerts", icon: Bell },
    { id: "backtesting", label: "Backtesting", icon: BarChart4 },
    { id: "data-quality", label: "Data Quality", icon: Database },
    { id: "model-governance", label: "Model Governance", icon: Settings },
    { id: "audit", label: "Audit", icon: LogOut },
  ];

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-gray-800 border-r border-gray-700 transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          {sidebarOpen && <h1 className="text-xl font-bold text-blue-400">IEIS</h1>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-gray-700 rounded"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
                title={!sidebarOpen ? item.label : ""}
              >
                <Icon size={20} />
                {sidebarOpen && <span className="text-sm">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Settings */}
        <div className="p-2 border-t border-gray-700">
          <button
            onClick={() => onNavigate("settings")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentPage === "settings"
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-700"
            }`}
          >
            <Settings size={20} />
            {sidebarOpen && <span className="text-sm">Settings</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Master Control Bar */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Mode:</span>
              <span className="text-green-400 font-semibold">ALERT_ONLY</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Market:</span>
              <span className="text-green-400">● Open</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Time:</span>
              <span className="text-white">{new Date().toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Broker:</span>
              <span className="text-green-400">● Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Risk:</span>
              <span className="text-yellow-400">45%</span>
            </div>
            <button className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold">
              KILL SWITCH
            </button>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
};
