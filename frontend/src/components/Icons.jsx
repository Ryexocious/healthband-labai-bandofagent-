/* ── Material Symbol Icon Component ─────────────────────────── */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

// Material Symbols Outlined wrapper
export function MIcon({ name, size = 24, filled = false, className = '', style = {}, ...props }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0",
        ...style,
      }}
      {...props}
    >
      {name}
    </span>
  );
}

// SVG Icons kept for specific use cases
export function BrandMark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M2 10h3.5l1.5-4.5 3 9 1.5-4.5H18"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function IconShield(props) {
  return (
    <svg {...stroke} width={16} height={16} viewBox="0 0 16 16" {...props}>
      <path d="M8 1.5l5 2.5v4c0 2.9-2.1 5.3-5 6-2.9-.7-5-3.1-5-6v-4l5-2.5z" />
    </svg>
  );
}

export function IconPlus(props) {
  return <svg {...stroke} width={14} height={14} viewBox="0 0 14 14" {...props}><path d="M7 2v10M2 7h10" /></svg>;
}

export function IconFile(props) {
  return <svg {...stroke} width={14} height={14} viewBox="0 0 14 14" {...props}><path d="M4 1.5h5l3 3v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-10a1 1 0 011-1z" /><path d="M9 1.5v3h3" /></svg>;
}

// Agent icon mappings using Material Symbols names
const AGENT_ICON_MAP = {
  'Intake Agent': 'input',
  'Diagnostic Agent': 'neurology',
  'Reviewer Agent': 'verified_user',
  'Doctor Liaison': 'forum',
  'Solution Agent': 'assignment_turned_in',
};

const CHANNEL_ICON_MAP = {
  '#intake': 'input',
  '#diagnosis': 'neurology',
  '#review': 'verified_user',
  '#doctor-comms': 'forum',
  '#solutions': 'assignment_turned_in',
  '#emergency': 'emergency',
};

// Sidebar navigation icons
const SIDEBAR_NAV_ICONS = {
  'Diagnostic Hub': 'clinical_notes',
  'Imaging Agent': 'biotech',
  'Labs Agent': 'science',
  'Pharmacy Agent': 'medication',
  'Clinical Summary': 'summarize',
  'Final Report': 'assignment_turned_in',
  'Doctor Portal': 'dashboard',
  'Intake Form': 'description',
  'Patient Files': 'folder',
};

export function AgentIcon({ name, size = 20, ...props }) {
  const iconName = AGENT_ICON_MAP[name] || 'smart_toy';
  return <MIcon name={iconName} size={size} {...props} />;
}

export function ChannelIcon({ channel, size = 18, ...props }) {
  const iconName = CHANNEL_ICON_MAP[channel] || 'forum';
  return <MIcon name={iconName} size={size} {...props} />;
}

export function SidebarNavIcon({ label, size = 20, ...props }) {
  const iconName = SIDEBAR_NAV_ICONS[label] || 'article';
  return <MIcon name={iconName} size={size} {...props} />;
}

// Legacy exports for compatibility
export function IconSymptoms(props) { return <MIcon name="record_voice_over" size={16} {...props} />; }
export function IconVitals(props) { return <MIcon name="monitor_heart" size={16} {...props} />; }
export function IconUpload(props) { return <MIcon name="upload_file" size={18} {...props} />; }
export function IconAgents(props) { return <MIcon name="smart_toy" size={16} {...props} />; }
export function IconTerminal(props) { return <MIcon name="terminal" size={16} {...props} />; }
export function IconDoctor(props) { return <MIcon name="person" size={16} {...props} />; }
export function IconEmergency(props) { return <MIcon name="warning" size={16} {...props} />; }
export function IconPhone(props) { return <MIcon name="phone_in_talk" size={16} filled {...props} />; }
export function IconIntake(props) { return <MIcon name="input" size={14} {...props} />; }
export function IconDiagnostic(props) { return <MIcon name="neurology" size={14} {...props} />; }
export function IconReview(props) { return <MIcon name="verified_user" size={14} {...props} />; }
export function IconSolution(props) { return <MIcon name="assignment_turned_in" size={14} {...props} />; }
