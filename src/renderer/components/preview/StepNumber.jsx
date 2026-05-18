export default function StepNumber({ n, critical = false, size = 'md' }) {
  const dim = size === 'sm' ? 22 : size === 'lg' ? 36 : 28;
  return (
    <div
      style={{
        width: dim,
        height: dim,
        minWidth: dim,
        borderRadius: '50%',
        background: critical ? '#FF6F00' : '#003366',
        color: 'white',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size === 'sm' ? '10pt' : size === 'lg' ? '14pt' : '11pt',
        fontFamily: 'Arial, sans-serif',
        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
      }}
    >
      {n}
    </div>
  );
}
