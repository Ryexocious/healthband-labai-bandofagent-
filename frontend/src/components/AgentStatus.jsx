import { AgentIcon } from './Icons';

const STATUS_LABEL = {
  idle: 'Waiting',
  working: 'Active',
  reviewing: 'Reviewing',
  done: 'Processed',
  error: 'Error',
};

export default function AgentStatus({ agents }) {
  // Map our internal agent status to the UI status if needed
  const getUiStatus = (status) => {
    if (status === 'done') return 'done';
    if (status === 'working') return 'working';
    if (status === 'error') return 'error';
    if (status === 'reviewing') return 'reviewing';
    return 'idle';
  };

  return (
    <>
      <h2 className="sidebar-right-title">Agent Health Status</h2>
      <div className="agent-health-list">
        {agents.map((agent) => {
          const uiStatus = getUiStatus(agent.status);
          return (
            <article key={agent.name} className="agent-health-card">
              <div className="agent-health-info">
                <AgentIcon name={agent.name} />
                <div>
                  <div className="agent-health-name">{agent.name}</div>
                  <div className="agent-health-status-text" style={{ fontSize: '12px', color: 'var(--hb-text-secondary)', marginTop: '2px' }}>
                    {STATUS_LABEL[uiStatus]}
                  </div>
                </div>
              </div>
              <div className={`agent-status-dot ${uiStatus}`} aria-label={STATUS_LABEL[uiStatus]} />
            </article>
          );
        })}
      </div>
    </>
  );
}
