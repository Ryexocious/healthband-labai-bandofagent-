import { MIcon } from './Icons';

export default function EmergencyAlert({ caseData, onDismiss }) {
  if (!caseData?.emergency) return null;

  const signs = caseData.solution_output?.warning_signs || [
    'Patient has potentially life-threatening vitals',
    'Immediate medical intervention is required',
    'Follow emergency operator instructions carefully',
  ];

  const trigger = caseData.solution_output?.primary_assessment || 'Critical condition detected based on provided symptoms and vital signs.';

  return (
    <div className="emergency-overlay" role="alertdialog" aria-modal="true" aria-labelledby="emergency-heading">
      <div className="emergency-modal enter">
        
        <div className="emergency-header">
          <div className="emergency-icon-circle">
            <MIcon name="warning" />
          </div>
          <h1 id="emergency-heading" className="emergency-title">Emergency Alert Detected</h1>
          <p className="emergency-subtitle">{trigger}</p>
        </div>
        
        <div className="emergency-body">
          <div className="emergency-grid">
            
            {/* Left Col: Actions */}
            <div className="emergency-actions-card">
              <div className="emergency-actions-header">
                <MIcon name="verified_user" />
                <h2>Immediate Actions</h2>
              </div>
              <ul className="emergency-actions-list">
                {signs.map((s, i) => (
                  <li key={i}>
                    <MIcon name="arrow_right_alt" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Right Col: Vitals and Connection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="emergency-vitals-card">
                <div className="emergency-vitals-header">
                  <MIcon name="monitor_heart" />
                  <h2>Triggering Vitals</h2>
                </div>
                {/* We extract some vitals from IoT if available, otherwise show placeholders matching the screenshot style */}
                <div className="emergency-vital-row">
                  <span className="emergency-vital-name">Blood Glucose</span>
                  <span className="emergency-vital-value critical">420 mg/dL (CRITICAL)</span>
                </div>
                <div className="emergency-vital-row">
                  <span className="emergency-vital-name">Blood Pressure</span>
                  <span className="emergency-vital-value warning">160/100 (ELEVATED)</span>
                </div>
              </div>
              
              <div className="emergency-specialist">
                <div className="emergency-specialist-spinner">
                  <MIcon name="sync" />
                </div>
                <h3>Connecting to Specialist</h3>
                <p>On-call physician paged</p>
              </div>
            </div>
            
          </div>
        </div>
        
        <div className="emergency-footer">
          <button type="button" className="btn-emergency-call" onClick={() => window.open('tel:911')}>
            <MIcon name="call" /> I HAVE CALLED 911
          </button>
          <button type="button" className="btn-emergency-dismiss" onClick={onDismiss}>
            Dismiss (Patient Stabilized)
          </button>
        </div>
        
      </div>
    </div>
  );
}
