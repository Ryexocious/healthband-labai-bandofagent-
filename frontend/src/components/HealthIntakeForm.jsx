import { useState, useCallback } from 'react';
import { MIcon } from './Icons';

const SCENARIOS = [
  {
    id: 'critical',
    style: 's-rose',
    name: 'Diabetic emergency',
    desc: 'Critical glucose, severe symptoms',
    symptoms: 'Severe fatigue, extreme thirst, frequent urination, blurred vision for 2 weeks. Feeling dizzy and nauseous today.',
    iot: { blood_glucose: '420', bp_sys: '160', bp_dia: '100', spo2: '96', heart_rate: '110' },
  },
  {
    id: 'wellness',
    style: 's-blue',
    name: 'Routine wellness',
    desc: 'Mild fatigue, normal vitals',
    symptoms: 'Mild fatigue and occasional headache for about 3 days. Sleeping poorly.',
    iot: { blood_glucose: '95', bp_sys: '118', bp_dia: '76', spo2: '98', heart_rate: '72' },
  },
  {
    id: 'respiratory',
    style: 's-violet',
    name: 'Respiratory concern',
    desc: 'Persistent cough, low SpO2',
    symptoms: 'Persistent dry cough for 10 days, mild shortness of breath during exercise, occasional chest tightness.',
    iot: { blood_glucose: '105', bp_sys: '125', bp_dia: '82', spo2: '93', heart_rate: '88' },
  },
];

export default function HealthIntakeForm({ onCaseStarted, isLoading, liveCaseData, isLive, onViewResults, agents }) {
  const [symptoms, setSymptoms] = useState('');
  const [iot, setIot] = useState({
    blood_glucose: '', bp_sys: '', bp_dia: '', spo2: '', heart_rate: '',
  });
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  const loadScenario = (s) => {
    setSymptoms(s.symptoms);
    setIot({
      blood_glucose: s.iot.blood_glucose || '',
      bp_sys: s.iot.bp_sys || '',
      bp_dia: s.iot.bp_dia || '',
      spo2: s.iot.spo2 || '',
      heart_rate: s.iot.heart_rate || '',
    });
  };

  const handleFiles = useCallback((incoming) => {
    const valid = Array.from(incoming).filter((f) => {
      const ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      return ok.includes(f.type) && f.size <= 10 * 1024 * 1024;
    });
    setFiles((prev) => [...prev, ...valid]);
  }, []);

  const handleSubmit = () => {
    if (!symptoms.trim() && !Object.values(iot).some(Boolean)) return;

    const formData = new FormData();
    formData.append('symptoms', symptoms);
    
    // Format BP
    if (iot.bp_sys && iot.bp_dia) {
      formData.append('blood_pressure', `${iot.bp_sys}/${iot.bp_dia}`);
    }
    if (iot.blood_glucose) formData.append('blood_glucose', iot.blood_glucose);
    if (iot.spo2) formData.append('spo2', iot.spo2);
    if (iot.heart_rate) formData.append('heart_rate', iot.heart_rate);
    
    files.forEach((f) => formData.append('files', f));
    onCaseStarted(formData);
  };

  const canSubmit = symptoms.trim() || Object.values(iot).some(Boolean);

  if (isLive || liveCaseData) {
    const activeAgent = agents?.find(a => a.status === 'working') || agents?.[0];
    const isDone = ['completed', 'COMPLETED', 'DOCTOR_REVIEW'].includes(liveCaseData?.status);
    
    return (
      <div className="processing-container">
        <div className="processing-header">
          <MIcon name={isDone ? "check_circle" : "auto_awesome"} size={48} className={isDone ? "text-success" : "text-brand pulse"} />
          <h2>{isDone ? "Analysis Complete" : "AI Agents Analyzing..."}</h2>
          <p>Total Agents Online: {agents?.length || 5}</p>
        </div>

        <div className="processing-agents-grid">
          {agents?.map((agent, i) => (
            <div key={agent.name} className={`processing-agent-card ${agent.status}`}>
              <div className="processing-agent-icon">
                {agent.status === 'done' ? <MIcon name="check_circle" /> : 
                 agent.status === 'working' ? <MIcon name="sync" className="spin" /> : 
                 <MIcon name="hourglass_empty" />}
              </div>
              <div className="processing-agent-info">
                <div className="processing-agent-name">{agent.name}</div>
                <div className="processing-agent-status">
                  {agent.status === 'done' ? 'Completed' : 
                   agent.status === 'working' ? 'Analyzing...' : 'Waiting'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {isDone && (
          <div className="processing-actions">
            <button className="btn-primary btn-lg" onClick={onViewResults}>
              View Final Report <MIcon name="arrow_forward" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="intake-header">
        <div className="intake-header-text">
          <h1>Intake Data Processing</h1>
          <p>Please enter patient symptoms and sync vitals device. Agents will process sequentially.</p>
        </div>
        {isLoading && (
          <div className="intake-status-pill">
            <div className="pulse-dot" />
            <span className="intake-status-label">PROCESSING</span>
          </div>
        )}
      </div>

      <div className="intake-grid">
        <div className="intake-left">
          
          <div className="scenario-section">
            <div className="scenario-section-label">Quick Scenarios</div>
            <div className="scenario-grid">
              {SCENARIOS.map((s) => (
                <button key={s.id} type="button" className={`scenario-card ${s.style}`} onClick={() => loadScenario(s)}>
                  <span className="scenario-severity">{s.id}</span>
                  <span className="scenario-name">{s.name}</span>
                  <span className="scenario-desc">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="chief-complaint-card">
            <div className="chief-complaint-header">
              <MIcon name="edit_note" />
              <h3>Chief Complaint</h3>
            </div>
            <textarea
              className="chief-complaint-textarea"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Patient reported experiencing..."
            />
          </div>

          <div
            className={`dropzone${dragOver ? ' over' : ''}`}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => document.getElementById('hb-files').click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && document.getElementById('hb-files').click()}
          >
            <div className="dropzone-icon"><MIcon name="upload_file" /></div>
            <div className="dropzone-text">Upload Patient Files</div>
            <div className="dropzone-hint">Drag and drop lab results, imaging, or previous clinical notes here. Supported formats: PDF, JPG, PNG</div>
            <button className="dropzone-browse">Browse Files</button>
            <input id="hb-files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" hidden onChange={(e) => handleFiles(e.target.files)} />
          </div>
          
          {files.length > 0 && (
            <div className="file-list" style={{ marginTop: '-16px' }}>
              {files.map((f, i) => (
                <div key={i} className="file-row">
                  <span className="file-row-name"><MIcon name="description" size={16} />{f.name}</span>
                  <button type="button" className="file-remove" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove">
                    <MIcon name="close" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="intake-right">
          <div className="vitals-panel">
            <div className="vitals-panel-header">
              <MIcon name="monitor_heart" />
              <h3>Vitals & IoT Readings</h3>
            </div>
            
            <div className="vitals-body">
              <div className="vital-field">
                <label>Blood Pressure (mmHg)</label>
                <div className="field-input-row">
                  <input
                    className="field-input field-input-sm"
                    type="number"
                    value={iot.bp_sys}
                    onChange={(e) => setIot({ ...iot, bp_sys: e.target.value })}
                    placeholder="120"
                  />
                  <span className="separator">/</span>
                  <input
                    className="field-input field-input-sm"
                    type="number"
                    value={iot.bp_dia}
                    onChange={(e) => setIot({ ...iot, bp_dia: e.target.value })}
                    placeholder="80"
                  />
                </div>
              </div>

              <div className="vital-field">
                <label>Heart Rate</label>
                <div className="vital-input-wrap">
                  <input
                    className="field-input"
                    type="number"
                    value={iot.heart_rate}
                    onChange={(e) => setIot({ ...iot, heart_rate: e.target.value })}
                    placeholder="75"
                  />
                  <MIcon name="favorite" className="vital-input-icon" style={{ color: '#D32F2F' }} filled />
                </div>
              </div>

              <div className="vital-field">
                <label>SpO2 (%)</label>
                <div className="vital-input-wrap">
                  <input
                    className="field-input"
                    type="number"
                    value={iot.spo2}
                    onChange={(e) => setIot({ ...iot, spo2: e.target.value })}
                    placeholder="98"
                  />
                  <span className="vital-input-icon" style={{ fontSize: '14px', fontFamily: 'var(--hb-font-mono)', fontWeight: 600 }}>O2</span>
                </div>
              </div>

              <div className="vital-field">
                <label>Blood Glucose (mg/dL)</label>
                <div className="vital-input-wrap">
                  <input
                    className="field-input"
                    type="number"
                    value={iot.blood_glucose}
                    onChange={(e) => setIot({ ...iot, blood_glucose: e.target.value })}
                    placeholder="90"
                  />
                  <MIcon name="bloodtype" className="vital-input-icon" style={{ color: '#D32F2F' }} />
                </div>
              </div>
            </div>
            
            <div className="vitals-footer">
              <button 
                type="button" 
                className="btn-submit" 
                disabled={isLoading || !canSubmit}
                onClick={handleSubmit}
              >
                <MIcon name="arrow_forward" /> 
                {isLoading ? 'PROCESSING...' : 'SUBMIT TO AGENTS'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
