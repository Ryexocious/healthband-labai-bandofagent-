import { useState, useCallback, useEffect } from 'react';
import HealthIntakeForm from './components/HealthIntakeForm';
import BandWorkspace from './components/BandWorkspace';
import AgentStatus from './components/AgentStatus';
import EmergencyAlert from './components/EmergencyAlert';
import FinalReport from './components/FinalReport';
import ImagingAgent from './components/ImagingAgent';
import LabsAgent from './components/LabsAgent';
import PharmacyAgent from './components/PharmacyAgent';
import Login from './components/Login';
import DoctorPortal from './components/DoctorPortal';
import PatientFiles from './components/PatientFiles';
import { NotificationsDropdown, SettingsDropdown, ProfileDropdown } from './components/NavDropdowns';
import { MIcon, SidebarNavIcon } from './components/Icons';
import './styles/healthband.css';

const API_BASE = 'http://localhost:8000';

const DEFAULT_AGENTS = [
  { name: 'Intake Agent', status: 'idle', model: 'gpt-4o', channel: '#intake' },
  { name: 'Diagnostic Agent', status: 'idle', model: 'deepseek-r1', channel: '#diagnosis' },
  { name: 'Reviewer Agent', status: 'idle', model: 'claude-3-5-sonnet', channel: '#review' },
  { name: 'Doctor Liaison', status: 'idle', model: 'gpt-4o-mini', channel: '#doctor-comms' },
  { name: 'Solution Agent', status: 'idle', model: 'claude-3-5-sonnet', channel: '#solutions' },
  { name: 'Pharmacy Agent', status: 'idle', model: 'gpt-4o', channel: '#pharmacy' },
];

export default function App() {
  const [user, setUser] = useState(null);
  
  const [caseData, setCaseData] = useState(null);
  const [bandData, setBandData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [error, setError] = useState(null);
  const [agents, setAgents] = useState(DEFAULT_AGENTS);
  
  const [currentView, setCurrentView] = useState('dashboard');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [liveCaseId, setLiveCaseId] = useState(null);

  useEffect(() => {
    const savedUser = sessionStorage.getItem('hb_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      if (parsedUser.theme_preference === 'dark') {
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
      }
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('hb_user');
    sessionStorage.removeItem('hb_token');
    setUser(null);
    setCurrentView('dashboard');
  };

  const handleCaseStarted = useCallback(async (formData) => {
    setIsLoading(true);
    setError(null);
    setCaseData(null);
    setBandData(null);
    setShowEmergency(false);
    setAgents(DEFAULT_AGENTS.map((a) => ({ ...a, status: 'idle' })));
    setCurrentView('dashboard'); // Stay on dashboard for patient

    try {
      const token = sessionStorage.getItem('hb_token');
      const response = await fetch(`${API_BASE}/api/cases`, { 
        method: 'POST', 
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();
      setCaseData(data);
      setLiveCaseId(data.case_id);
      setAgents(data.agent_statuses || DEFAULT_AGENTS.map((a) => ({ ...a, status: 'working' })));
      
    } catch (err) {
      console.error('Case submission error:', err);
      setError(err.message || 'Failed to process case');
      setAgents((prev) => prev.map((a) =>
        a.status === 'working' ? { ...a, status: 'error', error_message: err.message } : a,
      ));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll for live case updates
  useEffect(() => {
    if (!liveCaseId) return;
    
    let interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/cases/${liveCaseId}/status`);
        if (res.ok) {
          const statusData = await res.json();
          setCaseData(prev => prev ? { ...prev, ...statusData } : statusData);
          setAgents(statusData.agent_statuses || agents);
          
          if (statusData.emergency) {
            setShowEmergency(true);
          }
          
          if (['completed', 'COMPLETED', 'emergency', 'EMERGENCY'].includes(statusData.status)) {
            const currentCaseId = liveCaseId;
            setLiveCaseId(null);
            clearInterval(interval);
            
            const fullRes = await fetch(`${API_BASE}/api/cases/${currentCaseId}`);
            if (fullRes.ok) {
              const fullData = await fullRes.json();
              setCaseData(fullData);
            }
          }
        }
      } catch(e) {
        console.error("Polling error:", e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [liveCaseId, agents]);

  // Fetch Band data when the user opens the Diagnostic Hub
  useEffect(() => {
    if (currentView === 'band' && caseData?.case_id) {
      const fetchBandData = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/cases/${caseData.case_id}/band`);
          if (res.ok) {
            setBandData(await res.json());
          }
        } catch(e) {
          console.error("Band data fetch error:", e);
        }
      };
      
      fetchBandData();
      
      // If the case is still live, poll for new messages
      if (liveCaseId) {
        const interval = setInterval(fetchBandData, 3000);
        return () => clearInterval(interval);
      }
    }
  }, [currentView, caseData?.case_id, liveCaseId]);

  const handleNewCase = () => {
    setCaseData(null);
    setBandData(null);
    setShowEmergency(false);
    setError(null);
    setAgents(DEFAULT_AGENTS);
    setLiveCaseId(null);
    setCurrentView('dashboard');
  };

  const handleCaseSelect = async (caseId) => {
    try {
      const response = await fetch(`${API_BASE}/api/cases/${caseId}`);
      if (response.ok) {
        const data = await response.json();
        setCaseData(data);
        setCurrentView('report');
        if (!['completed', 'COMPLETED', 'emergency', 'EMERGENCY'].includes(data.status)) {
          setLiveCaseId(caseId);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const refreshCaseData = async (caseId) => {
    try {
      const response = await fetch(`${API_BASE}/api/cases/${caseId}`);
      if (response.ok) {
        setCaseData(await response.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  const navItems = [
    { id: 'dashboard', label: user.role === 'DOCTOR' ? 'Doctor Portal' : 'Intake Form' },
    { id: 'files', label: 'Patient Files' }
  ];

  if (caseData) {
    navItems.push(
      { id: 'band', label: 'Diagnostic Hub' },
      { id: 'imaging', label: 'Imaging Agent' },
      { id: 'labs', label: 'Labs Agent' },
      { id: 'pharmacy', label: 'Pharmacy Agent' },
      { id: 'report', label: 'Final Report' }
    );
  }

  const handleDismissEmergency = () => {
    setShowEmergency(false);
    setCurrentView('report');
  };

  return (
    <div className="app-shell">
      {/* ── Top Navigation ─────────────────────────── */}
      <nav className="top-nav">
        <div className="nav-left">
          <div className="brand">
            <span className="brand-name">HealthBand</span>
          </div>
          <div className="nav-tabs">
            <button className={`nav-tab ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => { setCurrentView('dashboard'); }}>Dashboard</button>
            <button className={`nav-tab ${currentView === 'files' ? 'active' : ''}`} onClick={() => { setCurrentView('files'); }}>Patient Files</button>
          </div>
        </div>
        
        <div className="nav-right">
          <div className="nav-search">
            <MIcon name="search" />
            <input type="text" className="nav-search-input" placeholder="Search patient files..." />
          </div>
          <button className="nav-icon-btn" aria-label="Notifications" onClick={() => setActiveDropdown(activeDropdown === 'notifications' ? null : 'notifications')}>
            <MIcon name="notifications" />
          </button>
          <button className="nav-icon-btn" aria-label="Settings" onClick={() => setActiveDropdown(activeDropdown === 'settings' ? null : 'settings')}>
            <MIcon name="settings" />
          </button>
          <button className="nav-icon-btn" aria-label="Profile" title={user.name} onClick={() => setActiveDropdown(activeDropdown === 'profile' ? null : 'profile')}>
            <MIcon name="account_circle" />
          </button>
          <button className="btn-emergency-nav" onClick={() => window.open('tel:911')}>
            <MIcon name="emergency" filled /> Emergency
          </button>
          
          {activeDropdown === 'notifications' && <NotificationsDropdown onClose={() => setActiveDropdown(null)} />}
          {activeDropdown === 'settings' && <SettingsDropdown user={user} onClose={() => setActiveDropdown(null)} />}
          {activeDropdown === 'profile' && <ProfileDropdown user={user} onClose={() => setActiveDropdown(null)} onLogout={handleLogout} />}
        </div>
      </nav>

      {/* ── Left Sidebar ───────────────────────────── */}
      <aside className="sidebar-left">
        {caseData && (
          <div className="sidebar-case-header">
            <div className="sidebar-case-avatar">
              <MIcon name="person" />
            </div>
            <div>
              <div className="sidebar-case-title">Current Patient</div>
              <div className="sidebar-case-subtitle">ID: {caseData.case_id || 'PENDING'}</div>
            </div>
          </div>
        )}
        
        <div className="sidebar-nav">
          {navItems.map(item => (
            <button 
              key={item.id} 
              className={`sidebar-nav-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => {
                setCurrentView(item.id);
              }}
            >
              <SidebarNavIcon label={item.label} />
              {item.label}
            </button>
          ))}
        </div>
        
        <div className="sidebar-footer">
          {user.role === 'PATIENT' && (
            <button className="btn-new-analysis" onClick={handleNewCase}>
              <MIcon name="add_circle" /> New Analysis
            </button>
          )}
        </div>
      </aside>

      {/* ── Right Sidebar ──────────────────────────── */}
      <aside className="sidebar-right">
        <AgentStatus agents={agents} />
      </aside>

      {/* ── Main Content ───────────────────────────── */}
      <main className="main-content">
        <div className="main-content-inner">
          {error && (
            <div className="error-panel">
              <div className="error-title">Connection failed</div>
              <div className="error-body">{error}</div>
              <div className="error-actions">
                <button type="button" className="btn-ghost" onClick={() => setError(null)}>Dismiss</button>
              </div>
            </div>
          )}

          {currentView === 'dashboard' && user.role === 'PATIENT' && (
            <HealthIntakeForm
              onCaseStarted={handleCaseStarted}
              isLoading={isLoading}
              liveCaseData={caseData}
              isLive={!!liveCaseId}
              onViewResults={() => setCurrentView('report')}
              agents={agents}
            />
          )}

          {currentView === 'dashboard' && user.role === 'DOCTOR' && (
            <DoctorPortal onCaseSelect={handleCaseSelect} />
          )}

          {currentView === 'files' && (
            <PatientFiles onCaseSelect={handleCaseSelect} />
          )}
          
          {currentView === 'band' && (
            <BandWorkspace bandData={bandData} caseData={caseData} user={user} />
          )}

          {currentView === 'report' && (
            <FinalReport caseData={caseData} user={user} onDoctorSubmit={() => setLiveCaseId(caseData.case_id)} />
          )}
          
          {currentView === 'imaging' && (
            <ImagingAgent caseData={caseData} user={user} onRefresh={() => refreshCaseData(caseData.case_id)} />
          )}

          {currentView === 'labs' && (
            <LabsAgent caseData={caseData} user={user} onRefresh={() => refreshCaseData(caseData.case_id)} />
          )}

          {currentView === 'pharmacy' && (
            <PharmacyAgent caseData={caseData} user={user} onRefresh={() => refreshCaseData(caseData.case_id)} />
          )}
        </div>
      </main>

      {/* ── Mobile Bottom Nav ──────────────────────── */}
      <nav className="bottom-nav">
        <button className={`bottom-nav-item ${currentView === 'intake' ? 'active' : ''}`} onClick={() => setCurrentView('intake')}>
          <MIcon name="summarize" />
          <span className="bottom-nav-label">Summary</span>
        </button>
        <button className={`bottom-nav-item ${currentView === 'band' ? 'active' : ''}`} onClick={() => setCurrentView('band')}>
          <MIcon name="forum" />
          <span className="bottom-nav-label">Hub</span>
        </button>
        <button className={`bottom-nav-item ${currentView === 'report' ? 'active' : ''}`} onClick={() => setCurrentView('report')}>
          <MIcon name="assignment_turned_in" />
          <span className="bottom-nav-label">Report</span>
        </button>
        <button className="bottom-nav-item" onClick={() => setShowEmergency(true)}>
          <MIcon name="warning" />
          <span className="bottom-nav-label">Alerts</span>
        </button>
      </nav>

      {/* ── Modals ─────────────────────────────────── */}
      {showEmergency && (
        <EmergencyAlert caseData={caseData} onDismiss={handleDismissEmergency} />
      )}
    </div>
  );
}
