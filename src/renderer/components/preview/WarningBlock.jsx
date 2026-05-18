import { Info, AlertTriangle, OctagonAlert } from 'lucide-react';

const variants = {
  info: {
    bg: '#D1ECF1', border: '#17A2B8', text: '#0c5460', icon: Info, label: 'NOTE',
  },
  warning: {
    bg: '#FFF3CD', border: '#FFC107', text: '#856404', icon: AlertTriangle, label: 'ATTENTION',
  },
  danger: {
    bg: '#F8D7DA', border: '#DC3545', text: '#721c24', icon: OctagonAlert, label: 'DANGER',
  },
};

export default function WarningBlock({ type = 'info', text, compact = false }) {
  const v = variants[type] || variants.info;
  const Icon = v.icon;
  return (
    <div
      style={{
        background: v.bg,
        border: `1px solid ${v.border}`,
        borderLeft: `4px solid ${v.border}`,
        color: v.text,
        padding: compact ? '4pt 8pt' : '6pt 10pt',
        margin: '6pt 0',
        fontSize: '9pt',
        fontFamily: 'Arial, sans-serif',
        borderRadius: 2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <Icon style={{ width: 14, height: 14, marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <strong style={{ marginRight: 4 }}>{v.label} :</strong>
          {text}
        </div>
      </div>
    </div>
  );
}

export const noteVariants = variants;
