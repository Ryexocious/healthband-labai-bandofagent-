import { useEffect, useRef, useState } from 'react';
import { MIcon } from './Icons';

export default function BandWorkspace({ bandData, caseData, user }) {
  const endRef = useRef(null);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [referralSpecialist, setReferralSpecialist] = useState('');
  const [referralUrgency, setReferralUrgency] = useState('Routine');
  const [referralNotes, setReferralNotes] = useState('');
  const [referralSuccess, setReferralSuccess] = useState(false);
  const [showReferralForm, setShowReferralForm] = useState(false);

  // Parse diagnostic output
  let diagOutput = caseData?.diagnostic_output;
  if (typeof diagOutput === 'string') {
    try { diagOutput = JSON.parse(diagOutput); } catch(e) {}
  }
  
  const conditions = diagOutput?.conditions || [];
  const redFlags = diagOutput?.red_flags || [];
  const recommendedSpecialist = diagOutput?.recommended_specialist || '';
  const confidenceBasis = diagOutput?.confidence_basis || '';

  const channels = bandData?.channels || {};
  const allMessages = Object.values(channels).flat().sort((a, b) => {
    return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    
    setIsSending(true);
    try {
      const token = sessionStorage.getItem('hb_token');
      const res = await fetch(`http://localhost:8000/api/cases/${caseData.case_id}/band/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: messageText })
      });
      if (res.ok) {
        setMessageText('');
      }
    } catch(err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleReferral = async (e) => {
    e.preventDefault();
    if (!referralSpecialist) return;
    try {
      const token = sessionStorage.getItem('hb_token');
      const msg = `Referral placed: Patient referred to ${referralSpecialist} (${referralUrgency}). Notes: ${referralNotes || 'None'}`;
      const res = await fetch(`http://localhost:8000/api/cases/${caseData.case_id}/band/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: msg })
      });
      if (res.ok) {
        setReferralSuccess(true);
        setReferralNotes('');
        setTimeout(() => {
          setReferralSuccess(false);
          setShowReferralForm(false);
        }, 2000);
      }
    } catch(err) {
      console.error(err);
    }
  };

  const formatContent = (content) => {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return String(content);
    }
  };

  const getAccentColor = (author, type) => {
    if (!author) return 'primary';
    const authorLower = String(author).toLowerCase();
    if (authorLower.includes('intake')) return 'primary';
    if (authorLower.includes('diagnostic')) return 'secondary';
    if (type === 'Reviewer Note' || authorLower.includes('reviewer')) return 'warning';
    if (type === 'Emergency') return 'error';
    return 'primary';
  };

  const isReviewerNote = (msg) => {
    if (msg.message_type === 'Reviewer Note') return true;
    if (msg.author && String(msg.author).toLowerCase().includes('reviewer')) return true;
    return false;
  };

  return (
    <div className="band-hub-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="intake-header">
        <div className="intake-header-text">
          <h1>Diagnostic Collaboration Hub</h1>
          <p>Live AI agent differential diagnostics and interactive clinician message workspace.</p>
        </div>
      </div>

      <div className="band-workspace-split" style={{ display: 'flex', flex: 1, gap: '20px', minHeight: 0 }}>
        {/* Left Column: Clinical Differential Board */}
        <div className="clinical-board" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', padding: '20px', background: 'var(--hb-bg-dark, #fafafa)', borderRadius: '12px', border: '1px solid var(--hb-border, #eaeaea)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MIcon name="clinical_notes" style={{ color: 'var(--hb-primary)' }} /> Diagnostic Assessment Board
          </h2>
          
          {conditions.length === 0 ? (
            <div className="band-empty" style={{ padding: '20px' }}>
              <p>Awaiting diagnostic analysis payload...</p>
            </div>
          ) : (
            <>
              {/* Differential Diagnosis List */}
              <div className="diagnoses-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: '#666', margin: '10px 0 5px 0', letterSpacing: '0.05em' }}>Differential Diagnoses</h3>
                {conditions.map((cond, idx) => {
                  const confPct = Math.round(cond.confidence * 100);
                  const confColor = cond.confidence > 0.75 ? '#dc2626' : cond.confidence > 0.5 ? '#f97316' : '#2563eb';
                  return (
                    <div key={idx} style={{ padding: '12px 16px', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: `4px solid ${confColor}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '600', fontSize: '15px' }}>{cond.name}</span>
                        <span style={{ fontSize: '12px', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{cond.icd_code}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${confPct}%`, height: '100%', background: confColor, borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: confColor }}>{confPct}% Confidence</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Confidence Basis */}
              {confidenceBasis && (
                <div style={{ padding: '12px 16px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#4b5563', margin: '0 0 4px 0' }}>Confidence Basis / Evidence Cited</h4>
                  <p style={{ fontSize: '13px', color: '#1f2937', margin: 0, lineHeight: '1.4' }}>{confidenceBasis}</p>
                </div>
              )}

              {/* Recommended Specialist Referral */}
              {recommendedSpecialist && (
                <div style={{ padding: '12px 16px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#1e3a8a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MIcon name="badge" /> Recommended Specialist Referral: <strong style={{ textTransform: 'capitalize' }}>{recommendedSpecialist}</strong>
                    </span>
                    {user?.role === 'DOCTOR' && !showReferralForm && (
                      <button 
                        onClick={() => {
                          setReferralSpecialist(recommendedSpecialist);
                          setShowReferralForm(true);
                        }}
                        style={{ padding: '4px 10px', fontSize: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Place Referral
                      </button>
                    )}
                  </div>

                  {showReferralForm && (
                    <form onSubmit={handleReferral} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', borderTop: '1px solid #bfdbfe', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '11px', color: '#1e3a8a', fontWeight: 'bold' }}>Specialist Type</label>
                          <input 
                            type="text" 
                            value={referralSpecialist} 
                            onChange={(e) => setReferralSpecialist(e.target.value)} 
                            style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #93c5fd', borderRadius: '4px' }} 
                            required 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#1e3a8a', fontWeight: 'bold' }}>Urgency</label>
                          <select 
                            value={referralUrgency} 
                            onChange={(e) => setReferralUrgency(e.target.value)} 
                            style={{ padding: '6px', fontSize: '12px', border: '1px solid #93c5fd', borderRadius: '4px' }}
                          >
                            <option value="Routine">Routine</option>
                            <option value="Urgent">Urgent</option>
                            <option value="Stat">Stat (Emergency)</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#1e3a8a', fontWeight: 'bold' }}>Referral Notes</label>
                        <textarea 
                          value={referralNotes} 
                          onChange={(e) => setReferralNotes(e.target.value)} 
                          placeholder="Reason for referral..." 
                          style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #93c5fd', borderRadius: '4px', minHeight: '40px' }} 
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button type="button" onClick={() => setShowReferralForm(false)} style={{ padding: '4px 8px', fontSize: '12px', background: '#e5e7eb', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" style={{ padding: '4px 8px', fontSize: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Submit Referral</button>
                      </div>
                      {referralSuccess && (
                        <div style={{ color: '#047857', fontSize: '12px', fontWeight: 'bold', marginTop: '4px' }}>
                          Referral recorded and posted to Band Cloud.
                        </div>
                      )}
                    </form>
                  )}
                </div>
              )}

              {/* Red Flags Alert board */}
              {redFlags.length > 0 && (
                <div style={{ padding: '12px 16px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#991b1b', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MIcon name="warning" style={{ color: '#dc2626' }} /> Active Clinical Red Flags ({redFlags.length})
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#7f1d1d' }}>
                    {redFlags.map((flag, idx) => <li key={idx} style={{ marginBottom: '4px' }}>{flag}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Column: Live Band Feed */}
        <div className="band-feed-container" style={{ flex: 1.2, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="band-feed" style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid var(--hb-border, #eaeaea)' }}>
            {allMessages.length === 0 ? (
              <div className="band-empty">
                <div className="band-empty-icon"><MIcon name="forum" /></div>
                <p>Waiting for data payload... The workspace will populate as agents communicate.</p>
              </div>
            ) : (
              allMessages.map((msg, i) => {
                const accent = getAccentColor(msg.author, msg.message_type);
                const reviewer = isReviewerNote(msg);
                
                return (
                  <article key={msg.id || i} className={`band-message ${reviewer ? 'reviewer-note' : ''} enter`} style={{ animationDelay: `${Math.min(i * 50, 500)}ms`, margin: '0 0 16px 0' }}>
                    {!reviewer && <div className={`band-message-accent ${accent}`} />}
                    
                    <div className="band-message-body">
                      <div className="band-message-head">
                        <div className="band-message-author">
                          <div className={`band-author-avatar ${accent}`}>
                            <MIcon name={String(msg.author).toLowerCase().includes('intake') ? 'input' : String(msg.author).toLowerCase().includes('diagnostic') ? 'neurology' : 'forum'} />
                          </div>
                          <div>
                            <div className={`band-author-name ${accent}`}>{msg.author}</div>
                            <div className="band-author-channel">Data Payload | {new Date(msg.timestamp).toLocaleTimeString()}</div>
                          </div>
                        </div>
                        
                        <div className={`status-pill ${accent === 'warning' ? 'warning' : 'success'}`}>
                          <MIcon name={accent === 'warning' ? 'schedule' : 'check_circle'} filled />
                          {accent === 'warning' ? 'REVIEWING' : 'PROCESSED'}
                        </div>
                      </div>
                      
                      {typeof msg.content === 'string' && reviewer ? (
                        <div className="band-clinical-text">{msg.content}</div>
                      ) : (
                        <div className="band-json">{formatContent(msg.content)}</div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          {/* Interactive message composer */}
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px', padding: '12px 0 0 0' }}>
            <input 
              type="text" 
              value={messageText} 
              onChange={(e) => setMessageText(e.target.value)} 
              placeholder="Ask a question or send a query to the AI agents (e.g. @DiagnosticAgent)..." 
              style={{ flex: 1, padding: '12px 16px', fontSize: '14px', border: '1px solid var(--hb-border, #eaeaea)', borderRadius: '8px', outline: 'none' }}
              disabled={isSending}
            />
            <button 
              type="submit" 
              style={{ padding: '0 20px', background: 'var(--hb-primary, #2563eb)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              disabled={isSending || !messageText.trim()}
            >
              {isSending ? <MIcon name="sync" className="animate-spin" /> : <MIcon name="send" />} Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
