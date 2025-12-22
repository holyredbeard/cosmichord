import { useState } from 'react';
import { HomeIcon, UsersIcon, ChartBarIcon, CogIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

export default function App() {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-white shadow-lg transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0 -translate-x-full'}`}>
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600">Logo</h1>
        </div>
        <nav className="mt-4">
          {[
            { name: 'Dashboard', icon: HomeIcon, id: 'dashboard' },
            { name: 'Kunder', icon: UsersIcon, id: 'customers' },
            { name: 'Analys', icon: ChartBarIcon, id: 'analytics' },
            { name: 'Inställningar', icon: CogIcon, id: 'settings' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`flex w-full items-center px-6 py-3 ${
                activeNav === item.id 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className={`p-8 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex-1 max-w-xl">
            <input
              type="search"
              placeholder="Sök..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="ml-4 flex items-center">
            <div className="h-10 w-10 rounded-full bg-gray-200"></div>
            <span className="ml-3 text-gray-700">Användare</span>
          </div>
        </header>

        {/* Content Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="text-gray-500 text-sm">Aktiva användare</h3>
            <p className="text-3xl font-bold mt-2">1,234</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="text-gray-500 text-sm">Total försäljning</h3>
            <p className="text-3xl font-bold mt-2">$45,678</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="text-gray-500 text-sm">Väntande uppgifter</h3>
            <p className="text-3xl font-bold mt-2">12</p>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg bg-white shadow-sm">
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Datum</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Transaktion</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Belopp</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['2024-05-01', 'Webbdesign', '$1,200', 'Slutförd'],
                ['2024-05-02', 'SEO Optimering', '$800', 'Pågående'],
                ['2024-05-03', 'Social Media', '$450', 'Misslyckad'],
              ].map(([date, transaction, amount, status], i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{date}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{transaction}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{amount}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      status === 'Slutförd' ? 'bg-green-100 text-green-800' :
                      status === 'Pågående' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toggle Sidebar Button - Placed at bottom of screen */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-2 left-4 z-50 rounded-full bg-blue-600 p-3 text-white shadow-lg hover:bg-blue-700 focus:outline-none"
        aria-label={sidebarOpen ? "Stäng meny" : "Öppna meny"}
      >
        {sidebarOpen 
          ? <XMarkIcon className="h-6 w-6" /> 
          : <Bars3Icon className="h-6 w-6" />
        }
      </button>
    </div>
  );
} 