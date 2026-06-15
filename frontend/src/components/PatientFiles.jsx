import React, { useState, useEffect } from 'react';
import { MIcon } from './Icons';

export default function PatientFiles({ onCaseSelect }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      const token = sessionStorage.getItem('hb_token');
      const res = await fetch('http://localhost:8000/api/cases', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCases(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><MIcon name="sync" className="animate-spin mr-2" /> Loading your files...</div>;

  return (
    <div className="report-container">
      <div className="report-header">
        <div className="report-title">My Patient Files</div>
        <p className="text-gray-500">A secure history of your past clinical assessments.</p>
      </div>

      <div className="mt-6 space-y-4">
        {cases.length === 0 ? (
          <div className="band-empty">
            <div className="band-empty-icon"><MIcon name="folder_open" /></div>
            <p>You have no past cases on file.</p>
          </div>
        ) : (
          cases.map(c => (
            <div key={c.case_id} className="portal-case-card">
              <div className="portal-case-info">
                <h3>Assessment: {new Date(c.created_at).toLocaleDateString()}</h3>
                <p>Case ID: {c.case_id}</p>
                <p>Status: <span className="status-highlight" style={{color: 'var(--hb-normal-success)'}}>{c.status}</span></p>
              </div>
              <button 
                onClick={() => onCaseSelect(c.case_id)}
                className="btn-outline"
              >
                View Report
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
