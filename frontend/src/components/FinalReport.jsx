import { useState } from 'react';
import { MIcon } from './Icons';

export default function FinalReport({ caseData, user, onDoctorSubmit }) {
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const solution = caseData?.solution_output;
  const doctor = caseData?.doctor_response;

  const handleDownload = () => {
    window.print(); // Simple placeholder for PDF download
  };

  const handleDoctorSubmit = async (e) => {
    e.preventDefault();
    if (!responseText.trim()) return;
    setSubmitting(true);
    try {
      const token = sessionStorage.getItem('hb_token');
      await fetch('http://localhost:8000/api/doctor/respond', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          case_id: caseData.case_id,
          doctor_id: user.id,
          response_text: responseText,
          recommendations: [],
          follow_up_needed: false
        })
      });
      if (onDoctorSubmit) {
        onDoctorSubmit();
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };
  
  if (caseData?.status === 'DOCTOR_REVIEW' && !doctor) {
    const brief = caseData?.liaison_output?.clinical_brief || caseData?.diagnostic_output?.clinical_brief || 'Awaiting specialist assessment.';
    
    return (
      <div className="report-header">
        <div className="report-title-area">
          <MIcon name="medical_services" />
          <h1 className="report-title">Specialist Review Required</h1>
        </div>
        <p className="report-description">
          The HealthBand AI has completed the preliminary diagnosis. A specialist must review these findings before the final solution is generated.
        </p>

        <div className="report-bento" style={{ marginTop: '32px' }}>
          {/* Patient Profile */}
          <section className="report-card" style={{ gridColumn: 'span 6' }}>
            <div className="report-card-header">
              <MIcon name="person" />
              <h2 className="report-card-title">Patient Intake Profile</h2>
            </div>
            <div className="report-prose">
              <p><strong>Reported Symptoms:</strong></p>
              <p>{caseData.symptoms || 'No text symptoms reported.'}</p>
              {caseData.prescription_amount && (
                <p style={{ marginTop: '12px' }}><strong>Requested Prescription Amount:</strong> {caseData.prescription_amount}</p>
              )}
            </div>
          </section>

          {/* Synced Vitals */}
          <section className="report-card" style={{ gridColumn: 'span 6' }}>
            <div className="report-card-header">
              <MIcon name="monitor_heart" />
              <h2 className="report-card-title">IoT Vitals</h2>
            </div>
            <div className="report-prose">
              {caseData.iot_readings ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(
                    typeof caseData.iot_readings === 'string'
                      ? JSON.parse(caseData.iot_readings)
                      : caseData.iot_readings
                  ).map(([key, val]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--hb-outline-variant)', paddingBottom: '4px' }}>
                      <span style={{ textTransform: 'capitalize', color: 'var(--hb-text-secondary)', fontSize: '13px' }}>
                        {key.replace(/_/g, ' ').replace('mgdl', 'mg/dL').replace('percent', '%').replace('f', '°F').replace('kg', 'kg')}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{String(val)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No vitals synced for this case.</p>
              )}
            </div>
          </section>

          {/* AI Diagnostic Output */}
          {caseData.diagnostic_output && (
            <section className="report-card" style={{ gridColumn: 'span 6' }}>
              <div className="report-card-header">
                <MIcon name="neurology" />
                <h2 className="report-card-title">AI Diagnostic Analysis</h2>
              </div>
              <div className="report-prose">
                {(() => {
                  const diag = typeof caseData.diagnostic_output === 'string' ? JSON.parse(caseData.diagnostic_output) : caseData.diagnostic_output;
                  return (
                    <div>
                      <p><strong>Suspected Conditions:</strong></p>
                      <ul style={{ paddingLeft: '20px', marginTop: '6px', listStyleType: 'disc' }}>
                        {diag.conditions?.map((c, i) => (
                          <li key={i} style={{ marginBottom: '4px' }}>
                            <strong>{c.name}</strong> (Confidence: {Math.round(c.confidence * 100)}%) {c.icd_code ? `[ICD: ${c.icd_code}]` : ''}
                          </li>
                        ))}
                      </ul>
                      {diag.red_flags?.length > 0 && (
                        <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(211, 47, 47, 0.08)', borderRadius: '6px', color: '#D32F2F', fontSize: '13px', fontWeight: 500 }}>
                          ⚠️ Red Flags: {diag.red_flags.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </section>
          )}

          {/* Reviewer Output */}
          {caseData.reviewer_output && (
            <section className="report-card" style={{ gridColumn: 'span 6' }}>
              <div className="report-card-header">
                <MIcon name="verified_user" />
                <h2 className="report-card-title">AI Reviewer Assessment</h2>
              </div>
              <div className="report-prose">
                {(() => {
                  const rev = typeof caseData.reviewer_output === 'string' ? JSON.parse(caseData.reviewer_output) : caseData.reviewer_output;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p><strong>Verdict:</strong> <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{rev.review_verdict?.replace(/_/g, ' ') || 'Validated'}</span></p>
                      {rev.clinical_notes && <p><strong>Notes:</strong> {rev.clinical_notes}</p>}
                      {rev.imaging_note && <p><strong>Imaging Notes:</strong> {rev.imaging_note}</p>}
                    </div>
                  );
                })()}
              </div>
            </section>
          )}

          <section className="report-card" style={{ gridColumn: 'span 12' }}>
            <div className="report-card-header">
              <MIcon name="summarize" />
              <h2 className="report-card-title">Clinical Brief</h2>
            </div>
            <div className="report-prose">
              <p>{brief}</p>
            </div>
          </section>

          {user?.role === 'DOCTOR' ? (
            <section className="report-card" style={{ gridColumn: 'span 12', borderColor: 'var(--hb-primary)' }}>
              <div className="report-card-header">
                <MIcon name="medical_services" />
                <h2 className="report-card-title text-primary">Provide Specialist Assessment</h2>
              </div>
              <form onSubmit={handleDoctorSubmit} className="doctor-response-form">
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Clinical Notes & Assessment</label>
                <textarea 
                  className="doctor-response-textarea"
                  placeholder="Enter your professional assessment and recommendations here..."
                  value={responseText}
                  onChange={e => setResponseText(e.target.value)}
                  disabled={submitting}
                />
                <div className="doctor-response-actions">
                  <button 
                    type="submit" 
                    disabled={submitting || !responseText.trim()}
                    className="btn-primary"
                  >
                    {submitting ? 'Submitting...' : 'Submit Assessment'}
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <section className="report-card" style={{ gridColumn: 'span 12' }}>
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <MIcon name="pending" style={{ fontSize: '48px', color: 'var(--hb-tertiary)' }} />
                <h3 style={{ marginTop: '16px', fontSize: '18px', fontWeight: '500' }}>Waiting for Doctor</h3>
                <p style={{ marginTop: '8px', color: 'var(--hb-on-surface-variant)' }}>
                  Your case has been forwarded to a specialist. Please check back shortly for the final treatment plan.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  if (!solution) {
    return (
      <div className="report-header">
        <div className="report-title-area">
          <MIcon name="sync" className="spinner" />
          <h1 className="report-title">Synthesizing Report</h1>
        </div>
        <p className="report-description">Our clinical system is finalizing your assessment.</p>
        
        <div className="report-bento" style={{ marginTop: '32px' }}>
          <div className="report-card" style={{ gridColumn: 'span 12' }}>
            <div className="skeleton skeleton-line" style={{ width: '35%' }} />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" style={{ width: '78%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="report-header">
        <div>
          <div className="report-title-area">
            <MIcon name="verified" />
            <h1 className="report-title">Final Diagnostic Report</h1>
          </div>
          <p className="report-description">
            Synthesized by the HealthBand Clinical Intelligence System and reviewed by on-call specialists.
            Case ID: {caseData.case_id}
          </p>
        </div>
        <button type="button" className="btn-download" onClick={handleDownload}>
          <MIcon name="download" /> DOWNLOAD PDF
        </button>
      </div>

      <div className="report-bento">
        {/* Primary Assessment (Span 8) */}
        <section className="report-card" style={{ gridColumn: 'span 12' }}>
          {/* Note: using inline styles to span 8 columns on large screens via CSS in a real app, 
              but for simplicity here we'll just let CSS grid handle it or adjust inline */}
          <div className="report-card-header">
            <MIcon name="summarize" />
            <h2 className="report-card-title">Primary Assessment</h2>
          </div>
          <div className="report-prose">
            <p>Based on the reported symptoms and IoT vital signs, the following assessment has been generated.</p>
            <div className="report-core-finding">
              <p>{solution.primary_assessment}</p>
            </div>
            {doctor && doctor.response_text && (
              <>
                <p style={{ marginTop: '16px', fontWeight: 500 }}>Specialist Note ({doctor.doctor_name}):</p>
                <p>{doctor.response_text}</p>
              </>
            )}
          </div>
        </section>

        {/* Immediate Actions (Span 4 if grid was defined with 12 cols, but we'll stack on mobile) */}
        {solution.immediate_actions?.length > 0 && (
          <section className="report-card secondary" style={{ gridColumn: 'span 12' }}>
            <div className="report-card-header secondary">
              <MIcon name="assignment" />
              <h2 className="report-card-title">Immediate Actions</h2>
            </div>
            <div className="report-action-list">
              {solution.immediate_actions.map((action, i) => (
                <div key={i} className="report-action-item">
                  <MIcon name="check_circle" />
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Warning Banner (Full Width) */}
        {solution.warning_signs?.length > 0 && (
          <section className="report-warning-banner" style={{ gridColumn: 'span 12' }}>
            <div className="report-warning-icon">
              <MIcon name="warning" filled />
            </div>
            <div>
              <h2 className="report-warning-title">Warning Signs & Escalation</h2>
              <div className="report-warning-text">
                Return to the emergency room or call 911 immediately if you experience:
                <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
                  {solution.warning_signs.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* Lifestyle Changes (Span 6) */}
        {solution.lifestyle_changes?.length > 0 && (
          <section className="report-card" style={{ gridColumn: 'span 12' }}>
            <div className="report-card-header">
              <MIcon name="health_and_safety" />
              <h2 className="report-card-title">Lifestyle Changes</h2>
            </div>
            <div>
              {solution.lifestyle_changes.map((change, i) => (
                <div key={i} className="report-lifestyle-item">
                  <div className="report-lifestyle-icon">
                    <MIcon name={i % 2 === 0 ? "restaurant" : "directions_run"} />
                  </div>
                  <div>
                    <div className="report-lifestyle-label">{i % 2 === 0 ? "Nutrition" : "Activity"}</div>
                    <div className="report-lifestyle-text">{change}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Referrals (Span 6) */}
        {solution.specialist_referrals?.length > 0 && (
          <section className="report-card" style={{ gridColumn: 'span 12' }}>
            <div className="report-card-header">
              <MIcon name="group" />
              <h2 className="report-card-title">Specialist Referrals</h2>
            </div>
            <div>
              {solution.specialist_referrals.map((ref, i) => (
                <div key={i} className="report-referral-card">
                  <div className="report-referral-info">
                    <div className="report-referral-avatar">
                      <MIcon name="person" />
                    </div>
                    <div>
                      <div className="report-referral-name">{ref.type}</div>
                      <div className="report-referral-specialty">{ref.urgency} Priority</div>
                    </div>
                  </div>
                  <button className="report-referral-btn">Schedule</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Disclaimer */}
        <footer className="report-disclaimer" style={{ gridColumn: 'span 12' }}>
          <MIcon name="shield" />
          <span>
            {solution.disclaimer || 'This report is generated by an AI assistant and is intended for informational purposes only. It does not replace professional medical advice, diagnosis, or treatment.'}
          </span>
        </footer>

      </div>
    </>
  );
}
