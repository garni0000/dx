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
  Video,
  Trash2,
  Megaphone,
  Image,
  Mic,
  Type
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- TYPES ---
interface User {
  _id?: string;
  telegram_id: string;
  username: string;
  first_name: string;
  state: string;
  uid_1xbet: string;
  screenshot_reg_url: string;
  screenshot_dep_url: string;
  created_at: string;
  is_active: boolean;
}

interface Stats {
  total: number;
  active: number;
  pending: number;
  withId: number;
}

interface Template {
  _id: string;
  name: string;
  type: 'text' | 'photo' | 'video' | 'audio';
  content: string;
  media_url: string;
  btn_text: string;
  btn_url: string;
  created_at: string;
}

interface BotStep {
  step_id: string;
  message: string;
  media_url?: string;
  delay_ms: number;
  btn_text?: string;
  btn_url?: string;
  is_enabled: number;
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'broadcast' | 'bot-logic' | 'settings'>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [botConfigs, setBotConfigs] = useState<BotStep[]>([]);
  const [serverStatus, setServerStatus] = useState<{ ok: boolean; bot: boolean; admin: boolean }>({ ok: false, bot: false, admin: false });
  const [aiSystemPrompt, setAiSystemPrompt] = useState('');
  const [broadcastData, setBroadcastData] = useState({
    type: 'text' as 'text' | 'photo' | 'video' | 'audio',
    content: '',
    media_url: '',
    btn_text: '',
    btn_url: ''
  });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
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
      const [usersRes, statsRes, settingsRes, botRes, templatesRes] = await Promise.all([
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/settings', { headers }),
        fetch('/api/admin/bot-config', { headers }),
        fetch('/api/admin/templates', { headers })
      ]);

      if (usersRes.status === 403) return handleLogout();

      const usersData = await usersRes.json();
      const statsData = await statsRes.json();
      const settingsData = await settingsRes.json();
      const botData = await botRes.json();
      const templatesData = await templatesRes.json();

      setUsers(usersData);
      setStats(statsData);
      setAiSystemPrompt(settingsData.value);
      setBotConfigs(botData);
      setTemplates(templatesData);
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

  const deleteUser = async (telegramId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.")) return;

    try {
      await fetch(`/api/admin/users/${telegramId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUsers(prev => prev.filter(u => u.telegram_id !== telegramId));
    } catch (err) {
      alert("Erreur lors de la suppression");
      console.error(err);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastData.content && broadcastData.type === 'text') return alert("Le message est vide");
    if (!broadcastData.media_url && broadcastData.type !== 'text') return alert("L'URL du média est requise");
    if (!window.confirm("Voulez-vous lancer la diffusion à tous les utilisateurs ?")) return;

    setIsBroadcasting(true);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(broadcastData)
      });
      const data = await res.json();
      if (!res.ok) {
        alert("Erreur: " + (data.error || "La diffusion a échoué"));
      } else {
        let msg = `Diffusion terminée !\n👥 Total ciblé: ${data.totalCount}\n✅ Succès: ${data.successCount}\n❌ Échecs: ${data.failCount}`;
        if (data.failures && data.failures.length > 0) {
          msg += "\n\nQuelques erreurs :\n" + data.failures.map((f: any) => `- ID ${f.id}: ${f.error}`).join('\n');
        }
        alert(msg);
      }
    } catch (err) {
      alert("Erreur de connexion lors de la diffusion");
    } finally {
      setIsBroadcasting(false);
    }
  };

  const checkBotStatus = async () => {
    try {
      const res = await fetch('/api/admin/bot-status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.ok) {
        alert(`✅ Bot opérationnel !\nNom: ${data.me.first_name}\nUsername: @${data.me.username}`);
      } else {
        alert(`❌ Erreur Bot: ${data.error}`);
      }
    } catch (err) {
      alert("Erreur réseau lors du check bot");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsLoggedIn(false);
    setToken('');
  };

  const handleSaveTemplate = async () => {
    const name = prompt("Nom du template :");
    if (!name) return;
    try {
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...broadcastData, name })
      });
      const data = await res.json();
      setTemplates([data, ...templates]);
      alert("Template sauvegardé !");
    } catch (e) { alert("Erreur"); }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Supprimer ce template ?")) return;
    try {
      await fetch(`/api/admin/templates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setTemplates(templates.filter(t => t._id !== id));
    } catch (e) { alert("Erreur"); }
  };

  const updateSettings = async () => {
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: aiSystemPrompt })
      });
      alert("Prompt mis à jour !");
    } catch (err) {
      alert("Erreur lors de la mise à jour");
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
            icon={Megaphone} 
            label="Diffusion" 
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard label="Total Abonnés" value={stats.total} icon={Users} color="bg-blue-600" />
                    <StatCard label="Accès Actifs" value={stats.active} icon={CheckCircle} color="bg-emerald-500" />
                    <StatCard label="En Attente" value={stats.pending} icon={Clock} color="bg-amber-500" />
                    <StatCard label="IDs Valides" value={stats.withId} icon={ShieldCheck} color="bg-purple-600" />
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
                          <tr key={user.telegram_id} className="hover:bg-white/5 transition-colors">
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
                            <td className="px-6 py-4 flex items-center gap-3">
                              <button className="text-white hover:text-blue-400" title="Envoyer message">
                                <Send size={16} />
                              </button>
                              <button 
                                onClick={() => deleteUser(user.telegram_id)}
                                className="text-gray-500 hover:text-red-500 transition-colors"
                                title="Supprimer l'utilisateur"
                              >
                                <Trash2 size={16} />
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
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {users.map(user => (
                        <tr key={user.telegram_id} className="hover:bg-white/5 transition-colors">
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
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => deleteUser(user.telegram_id)}
                              className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                              title="Supprimer l'utilisateur"
                            >
                              <Trash2 size={18} />
                            </button>
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
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {botConfigs.map((step, idx) => (
                  <div 
                    key={step.step_id} 
                    className={`bg-gray-900 border ${step.is_enabled ? 'border-gray-800' : 'border-red-900/30 opacity-75'} rounded-2xl p-6 space-y-4 hover:border-blue-500/50 transition-all relative overflow-hidden`}
                  >
                    {!step.is_enabled && (
                      <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-tighter">
                        Désactivé
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center bg-black/30 p-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${step.is_enabled ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-800 text-gray-500'} flex items-center justify-center font-bold text-sm`}>
                          {idx + 1}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-200 uppercase tracking-tight text-xs">{step.step_id}</h4>
                          <p className="text-[10px] text-gray-500 font-medium">Configuration de l'étape</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStepChange(step.step_id, 'is_enabled', step.is_enabled ? 0 : 1)}
                          className={`p-1.5 rounded-lg transition-all ${step.is_enabled ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}
                          title={step.is_enabled ? "Désactiver cette partie" : "Activer cette partie"}
                        >
                          {step.is_enabled ? <CheckCircle size={18} /> : <XCircle size={18} />}
                        </button>
                        <button 
                          onClick={() => saveStep(step)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-blue-500/10 active:scale-95"
                        >
                          <Save size={14} /> Enregistrer
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-black/40 p-4 rounded-xl border border-gray-800/50 shadow-inner group">
                        <label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare size={12} /> Message 
                          </div>
                          <span className="text-gray-600 font-normal group-hover:text-gray-400 transition-colors">Texte envoyé par le bot</span>
                        </label>
                        <textarea
                          value={step.message}
                          onChange={(e) => handleStepChange(step.step_id, 'message', e.target.value)}
                          className="w-full bg-transparent text-sm text-white placeholder:text-gray-700 outline-none h-28 resize-none leading-relaxed"
                          placeholder="Écrivez le message ici... (Utilisez {name} pour le nom)"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/30 p-3 rounded-xl border border-gray-800/40">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5 px-1">
                            <Clock size={12} className="text-amber-500/50" /> Attente (ms)
                          </label>
                          <input
                            type="number"
                            value={step.delay_ms}
                            onChange={(e) => handleStepChange(step.step_id, 'delay_ms', parseInt(e.target.value))}
                            className="w-full bg-black/50 border border-gray-800/50 text-sm text-white px-3 py-2 rounded-lg outline-none font-mono focus:border-amber-500/30 transition-colors"
                          />
                        </div>
                        <div className="bg-black/30 p-3 rounded-xl border border-gray-800/40">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5 px-1">
                            <Video size={12} className="text-purple-500/50" /> Média (ID/URL)
                          </label>
                          <input
                            type="text"
                            value={step.media_url || ''}
                            onChange={(e) => handleStepChange(step.step_id, 'media_url', e.target.value)}
                            className="w-full bg-black/50 border border-gray-800/50 text-sm text-white px-3 py-2 rounded-lg outline-none truncate focus:border-purple-500/30 transition-colors"
                            placeholder="file_id ou URL"
                          />
                        </div>
                      </div>

                      <div className="bg-blue-600/5 border border-blue-500/10 p-5 rounded-2xl relative group">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="p-1 bg-blue-500/10 rounded-md">
                            <Plus size={12} className="text-blue-400" />
                          </div>
                          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Bouton d'Action</span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600 uppercase">TITRE</span>
                            <input
                              type="text"
                              value={step.btn_text || ''}
                              onChange={(e) => handleStepChange(step.step_id, 'btn_text', e.target.value)}
                              className="w-full bg-black/40 border border-gray-800 text-xs text-white pl-12 pr-3 py-2.5 rounded-xl outline-none placeholder:text-gray-700 focus:border-blue-500/20"
                              placeholder="ex: S'inscrire maintenant"
                            />
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600 uppercase">LIEN</span>
                            <input
                              type="text"
                              value={step.btn_url || ''}
                              onChange={(e) => handleStepChange(step.step_id, 'btn_url', e.target.value)}
                              className="w-full bg-black/40 border border-gray-800 text-xs text-white pl-12 pr-3 py-2.5 rounded-xl outline-none placeholder:text-gray-700 focus:border-blue-500/20"
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'broadcast' && (
            <div className="space-y-6">
              <div className="bg-[#0f1115] border border-gray-800/50 rounded-2xl p-6 md:p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 rounded-xl">
                      <Megaphone className="text-blue-500" size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Nouvelle Diffusion</h2>
                      <p className="text-sm text-gray-500">Envoyez un message à tous vos membres Telegram</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleSaveTemplate}
                    className="flex items-center gap-2 bg-blue-500/10 text-blue-400 px-4 py-2 rounded-xl border border-blue-500/20 text-xs font-bold hover:bg-blue-500/20 transition-all"
                  >
                    <Save size={14} /> Sauvegarder comme Template
                  </button>
                </div>

                {templates.length > 0 && (
                  <div className="mb-8 overflow-x-auto pb-2 flex gap-3">
                    {templates.map(t => (
                      <div key={t._id} className="flex-shrink-0 relative group">
                        <button
                          onClick={() => setBroadcastData({ type: t.type, content: t.content, media_url: t.media_url, btn_text: t.btn_text, btn_url: t.btn_url })}
                          className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-xs font-medium text-gray-300 hover:border-blue-500 hover:text-white transition-all flex items-center gap-2"
                        >
                          {t.name}
                        </button>
                        <button 
                          onClick={() => handleDeleteTemplate(t._id)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={8} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    {/* Message Type */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Type de Message</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: 'text', icon: <Type size={16} />, label: 'Texte' },
                          { id: 'photo', icon: <Image size={16} />, label: 'Photo' },
                          { id: 'video', icon: <Video size={16} />, label: 'Vidéo' },
                          { id: 'audio', icon: <Mic size={16} />, label: 'Voc/Aud' }
                        ].map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setBroadcastData(prev => ({ ...prev, type: t.id as any }))}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                              broadcastData.type === t.id 
                                ? 'bg-blue-500/10 border-blue-500 text-blue-500' 
                                : 'bg-black/20 border-gray-800/50 text-gray-500 hover:border-gray-700'
                            }`}
                          >
                            {t.icon}
                            <span className="text-[10px] font-medium">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Media URL */}
                    {broadcastData.type !== 'text' && (
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">URL du Média / File ID</label>
                        <input
                          type="text"
                          value={broadcastData.media_url}
                          onChange={(e) => setBroadcastData(prev => ({ ...prev, media_url: e.target.value }))}
                          className="w-full bg-black/40 border border-gray-800 text-white px-4 py-3 rounded-xl outline-none focus:border-blue-500/50 transition-colors"
                          placeholder="Collez le lien ou le file_id..."
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Message (Légende)</label>
                      <textarea
                        value={broadcastData.content}
                        onChange={(e) => setBroadcastData(prev => ({ ...prev, content: e.target.value }))}
                        className="w-full bg-black/40 border border-gray-800 text-white px-4 py-3 rounded-xl outline-none h-40 resize-none focus:border-blue-500/50 transition-colors"
                        placeholder="Écrivez votre message ici..."
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Action Button */}
                    <div className="bg-blue-500/5 border border-blue-500/10 p-6 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Plus size={14} className="text-blue-400" />
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Bouton d'Action (Optionnel)</span>
                      </div>
                      <div className="space-y-3">
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">TITRE</span>
                          <input
                            type="text"
                            value={broadcastData.btn_text}
                            onChange={(e) => setBroadcastData(prev => ({ ...prev, btn_text: e.target.value }))}
                            className="w-full bg-black/40 border border-gray-800 text-sm text-white pl-16 pr-4 py-3 rounded-xl outline-none"
                            placeholder="ex: Rejoindre le VIP"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">LIEN</span>
                          <input
                            type="text"
                            value={broadcastData.btn_url}
                            onChange={(e) => setBroadcastData(prev => ({ ...prev, btn_url: e.target.value }))}
                            className="w-full bg-black/40 border border-gray-800 text-sm text-white pl-16 pr-4 py-3 rounded-xl outline-none"
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Preview (Simple) */}
                    <div className="border border-gray-800/50 rounded-2xl p-6 bg-black/20">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block">Aperçu rapide</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={checkBotStatus}
                            className="text-[10px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/20 transition-colors"
                          >
                            Statut Bot
                          </button>
                          <button 
                            onClick={async () => {
                              const id = prompt("Entrez votre ID Telegram pour tester :");
                              if (!id) return;
                              try {
                                const res = await fetch('/api/admin/test-me', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                  body: JSON.stringify({ telegram_id: id })
                                });
                                const data = await res.json();
                                if (res.ok) alert("✅ Test envoyé ! Vérifiez votre Telegram.");
                                else alert("❌ Erreur : " + data.error);
                              } catch (e) { alert("Erreur réseau"); }
                            }}
                            className="text-[10px] bg-white/5 hover:bg-white/10 text-gray-400 px-2 py-1 rounded border border-gray-800 transition-colors"
                          >
                            Tester sur moi
                          </button>
                        </div>
                      </div>
                      <div className="bg-[#1c1f26] rounded-2xl p-4 max-w-[280px]">
                        {broadcastData.type !== 'text' && broadcastData.media_url && (
                          <div className="aspect-video bg-black/40 rounded-lg mb-3 flex items-center justify-center text-gray-600 border border-gray-800/50">
                            {broadcastData.type === 'photo' && <Image size={24} />}
                            {broadcastData.type === 'video' && <Play size={24} />}
                            {broadcastData.type === 'audio' && <Mic size={24} />}
                          </div>
                        )}
                        <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                          {broadcastData.content || <span className="text-gray-700 italic">Pas de message...</span>}
                        </p>
                        {broadcastData.btn_text && (
                          <div className="mt-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg text-center shadow-lg shadow-blue-900/20">
                            {broadcastData.btn_text}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={handleBroadcast}
                      disabled={isBroadcasting}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                    >
                      {isBroadcasting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Diffusion en cours...
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          Diffuser à {users.length} membres
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
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
                  value={aiSystemPrompt}
                  onChange={(e) => setAiSystemPrompt(e.target.value)}
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

          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
