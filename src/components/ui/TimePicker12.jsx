// 12-hour AM/PM time picker. Stores/returns value as a 24-hour "HH:mm" string
// (so existing fmt12 display + data stay compatible), but always shows AM/PM.
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function parse(value) {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return { h: '', m: '', ap: 'AM' };
  const [H, M] = value.split(':').map(Number);
  const ap = H >= 12 ? 'PM' : 'AM';
  const h = H % 12 || 12;
  return { h, m: M, ap };
}

function to24(h, m, ap) {
  if (h === '' || m === '') return '';
  let H = Number(h) % 12;
  if (ap === 'PM') H += 12;
  return `${String(H).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function TimePicker12({ value, onChange, className = '' }) {
  const { h, m, ap } = parse(value);
  const emit = (nh, nm, nap) => onChange(to24(nh, nm, nap));
  const sel = 'px-2 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary text-sm appearance-none';

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <select value={h} onChange={e => emit(e.target.value, m === '' ? 0 : m, ap)} className={sel} aria-label="Hour">
        <option value="">HH</option>
        {HOURS.map(x => <option key={x} value={x}>{x}</option>)}
      </select>
      <span className="text-on-surface-variant">:</span>
      <select value={m} onChange={e => emit(h === '' ? 12 : h, e.target.value, ap)} className={sel} aria-label="Minute">
        <option value="">MM</option>
        {MINUTES.map(x => <option key={x} value={x}>{String(x).padStart(2, '0')}</option>)}
      </select>
      <select value={ap} onChange={e => emit(h === '' ? 12 : h, m === '' ? 0 : m, e.target.value)} className={sel} aria-label="AM/PM">
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
