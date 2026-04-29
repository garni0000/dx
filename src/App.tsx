import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MessageSquare, 
  Settings, 
  CheckCircle, 
  XCircle, 
  BarChart3, 
  Send,
  LogOut,
  LayoutDashboard,
  Smartphone,
  ShieldCheck,
  Workflow,
  Plus,
  Play,
  Save,
  Clock,
  Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- TYPES ---
interface User {
  id: number;
  telegram_id: string;
  username: string;
  first_name: string;
  state: string;
  uid_1xbet: string;
  screenshot_reg_url: string;
  screenshot_dep_url: string;
  created_at: string;
  is_active: number;
}

interface Stats {
  total: number;
  active: number;
  pending: number;
}

interface BotStep {
  step_id: string;
  message: string;
  media_url?: string;
  delay_ms: number;
  btn_text?: string;
  btn_url?: string;
}

// --- COMPONENTS ---
const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const StatCard = ({ label, value, icon: Icon, color }: any) => (
  <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-gray-400 text-sm font-medium">{label}</p>
        <h3 className="text-3xl font-bold mt-1 text-white">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
  </div>
);

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('admin_token') || '');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [botConfigs, setBotConfigs] = useState<BotStep[]>([]);
  const [serverStatus, setServerStatus] = useState<{ ok: boolean; bot: boolean; admin: boolean }>({ ok: false, bot: false, admin: false });
  const [prompt, setPrompt] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      setIsLoggedIn(true);
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    try {
      const healthRes = await fetch('/api/health');
      const healthData = await healthRes.json();
      setServerStatus({ ok: true, bot: healthData.bot_token, admin: healthData.admin_id });

      const headers = { 'Authorization': `Bearer ${token}` };
      const [usersRes, statsRes, settingsRes, botRes] = await Promise.all([
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/settings', { headers }),
        fetch('/api/admin/bot-config', { headers })
      ]);

      if (usersRes.status === 403) return handleLogout();

      const usersData = await usersRes.json();
      const statsData = await statsRes.json();
      const settingsData = await settingsRes.json();
      const botData = await botRes.json();

      setUsers(usersData);
      setStats(statsData);
      setPrompt(settingsData.value);
      setBotConfigs(botData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStepChange = (id: string, field: string, value: any) => {
    setBotConfigs(prev => prev.map(s => s.step_id === id ? { ...s, [field]: value } : s));
  };

  const saveStep = async (step: BotStep) => {
    try {
      await fetch('/api/admin/bot-config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(step)
      });
      alert(`Étape ${step.step_id} enregistrée !`);
    } catch (err) {
      alert("Erreur lors de l'enregistrement");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        localStorage.setItem('admin_token', data.token);
        setIsLoggedIn(true);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsLoggedIn(false);
    setToken('');
  };

  const updateSettings = async () => {
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt })
      });
      alert("Prompt mis à jour !");
    } catch (err) {
      alert("Erreur lors de la mise à jour");
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastMessage) return;
    try {
      await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: broadcastMessage })
      });
      alert("Message envoyé !");
      setBroadcastMessage('');
    } catch (err) {
      alert("Erreur d'envoi");
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-gray-900 border border-gray-800 p-8 rounded-3xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-blue-500/20">
              <ShieldCheck className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white text-center">Rafa Admin Panel</h1>
            <p className="text-gray-400 mt-2">Connectez-vous pour continuer</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-gray-800 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 flex font-sans">
      {/* Sidebar */}
      <div className="w-64 border-right border-gray-800 p-6 hidden lg:flex flex-col gap-8 bg-gray-950">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Smartphone size={24} className="text-white" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
            Rafa VIP
          </span>
          <div className="flex gap-1.5 ml-auto">
            <div className={`w-2 h-2 rounded-full ${serverStatus.ok ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'} transition-all`} title="Serveur Status" />
            <div className={`w-2 h-2 rounded-full ${serverStatus.bot ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-gray-600'} transition-all`} title="Bot Telegram Status" />
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarItem 
            icon={Users} 
            label="Utilisateurs" 
            active={activeTab === 'users'} 
            onClick={() => setActiveTab('users')} 
          />
          <SidebarItem 
            icon={MessageSquare} 
            label="Broadcast" 
            active={activeTab === 'broadcast'} 
            onClick={() => setActiveTab('broadcast')} 
          />
          <SidebarItem 
            icon={Workflow} 
            label="Logique Bot" 
            active={activeTab === 'bot-logic'} 
            onClick={() => setActiveTab('bot-logic')} 
          />
          <SidebarItem 
            icon={Settings} 
            label="Configuration IA" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
        </nav>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
        >
          <LogOut size={20} />
          <span className="font-medium">Déconnexion</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-h-screen overflow-y-auto">
        <header className="p-8 border-b border-gray-800 flex justify-between items-center bg-black/50 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold capitalize">{activeTab}</h2>
            <p className="text-gray-500 text-sm">Gestion du bot Telegram et funnel VIP</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-full text-xs font-mono text-gray-400">
              Uptime: Connecté
            </div>
          </div>
        </header>

        <main className="p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {stats && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <StatCard label="Total Abonnés" value={stats.total} icon={Users} color="bg-blue-600" />
                    <StatCard label="Accès Actifs" value={stats.active} icon={CheckCircle} color="bg-emerald-500" />
                    <StatCard label="En Attente" value={stats.pending} icon={Clock} color="bg-amber-500" />
                  </div>
                )}

                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                    <h3 className="font-bold">Inscriptions Récentes</h3>
                    <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">Tout voir</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-black/20 text-gray-400 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4 font-medium">Utilisateur</th>
                          <th className="px-6 py-4 font-medium">État</th>
                          <th className="px-6 py-4 font-medium">Date</th>
                          <th className="px-6 py-4 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {users.slice(0, 5).map(user => (
                          <tr key={user.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-medium text-white">{user.first_name}</span>
                                <span className="text-xs text-gray-500">@{user.username || user.telegram_id}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                user.is_active ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-gray-800 text-gray-400 border border-gray-700'
                              }`}>
                                {user.state}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-500">
                              {new Date(user.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <button className="text-white hover:text-blue-400">
                                <Send size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-black/20 text-gray-400 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">ID Telegram</th>
                        <th className="px-6 py-4">Username</th>
                        <th className="px-6 py-4">UID 1xBet</th>
                        <th className="px-6 py-4">Étape</th>
                        <th className="px-6 py-4">Preuves</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {users.map(user => (
                        <tr key={user.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-sm font-mono text-gray-400">{user.telegram_id}</td>
                          <td className="px-6 py-4">@{user.username}</td>
                          <td className="px-6 py-4 text-emerald-400 font-bold">{user.uid_1xbet || '-'}</td>
                          <td className="px-6 py-4">
                             <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20">
                               {user.state}
                             </span>
                          </td>
                          <td className="px-6 py-4 flex gap-2">
                             {user.screenshot_reg_url && (
                               <a href={user.screenshot_reg_url} target="_blank" rel="noreferrer" className="p-1.5 bg-gray-800 rounded hover:bg-gray-700">
                                 <Smartphone size={14} className="text-amber-400" />
                               </a>
                             )}
                             {user.screenshot_dep_url && (
                               <a href={user.screenshot_dep_url} target="_blank" rel="noreferrer" className="p-1.5 bg-gray-800 rounded hover:bg-gray-700">
                                 <BarChart3 size={14} className="text-emerald-400" />
                               </a>
                             )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'bot-logic' && (
              <motion.div
                key="bot-logic"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="grid grid-cols-1 xl:grid-cols-2 gap-6"
              >
                {botConfigs.map((step, idx) => (
                  <div key={step.step_id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 hover:border-blue-500/50 transition-all">
                    <div className="flex justify-between items-center bg-black/30 p-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                          {idx + 1}
                        </div>
                        <h4 className="font-bold text-gray-200 uppercase tracking-tight">{step.step_id}</h4>
                      </div>
                      <button 
                        onClick={() => saveStep(step)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-blue-500/10"
                      >
                        <Save size={14} /> Enregistrer
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Message Telegram</label>
                        <textarea
                          value={step.message}
                          onChange={(e) => handleStepChange(step.step_id, 'message', e.target.value)}
                          className="w-full bg-black border border-gray-800 text-sm text-white p-3 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none h-24"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1">
                            <Clock size={12} /> Délai (ms)
                          </label>
                          <input
                            type="number"
                            value={step.delay_ms}
                            onChange={(e) => handleStepChange(step.step_id, 'delay_ms', parseInt(e.target.value))}
                            className="w-full bg-black border border-gray-800 text-sm text-white px-3 py-2 rounded-lg outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1">
                            <Video size={12} /> Media URL (opt)
                          </label>
                          <input
                            type="text"
                            value={step.media_url || ''}
                            onChange={(e) => handleStepChange(step.step_id, 'media_url', e.target.value)}
                            className="w-full bg-black border border-gray-800 text-sm text-white px-3 py-2 rounded-lg outline-none"
                            placeholder="t.me/video/..."
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-gray-800 pt-4">
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">Texte Bouton</label>
                          <input
                            type="text"
                            value={step.btn_text || ''}
                            onChange={(e) => handleStepChange(step.step_id, 'btn_text', e.target.value)}
                            className="w-full bg-black border border-gray-800 text-sm text-white px-3 py-2 rounded-lg outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">URL Bouton</label>
                          <input
                            type="text"
                            value={step.btn_url || ''}
                            onChange={(e) => handleStepChange(step.step_id, 'btn_url', e.target.value)}
                            className="w-full bg-black border border-gray-800 text-sm text-white px-3 py-2 rounded-lg outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl bg-gray-900 border border-gray-800 p-8 rounded-3xl space-y-6"
              >
                <div className="flex items-center gap-3 text-blue-400 font-bold">
                  <Settings size={24} />
                  <span>Prompt Système de l'IA (OpenRouter)</span>
                </div>
                <p className="text-gray-400 text-sm">
                  Modifiez le comportement du bot VIP. Ce prompt définit sa personnalité et ses connaissances.
                </p>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-48 bg-black border border-gray-800 text-white p-4 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none font-mono text-sm leading-relaxed"
                />
                <button
                  onClick={updateSettings}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                >
                  <CheckCircle size={20} />
                  Sauvegarder les modifications
                </button>
              </motion.div>
            )}

            {activeTab === 'broadcast' && (
              <motion.div
                key="broadcast"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl bg-gray-900 border border-gray-800 p-8 rounded-3xl space-y-6"
              >
                <div className="flex items-center gap-3 text-emerald-400 font-bold">
                  <Send size={24} />
                  <span>Envoi Groupé (Broadcast)</span>
                </div>
                <p className="text-gray-400 text-sm">
                  Ce message sera envoyé à TOUS les utilisateurs inscrits dans la base de données. Attention à ne pas spammer.
                </p>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full h-32 bg-black border border-gray-800 text-white p-4 rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                  placeholder="Tapez votre message ici..."
                />
                <button
                  onClick={sendBroadcast}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-2"
                >
                  <XCircle size={20} className="rotate-45" />
                  Diffuser le message
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
