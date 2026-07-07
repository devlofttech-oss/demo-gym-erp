import { useNavigate } from 'react-router-dom';

export default function MembershipExpiredModal({ member, onClose }) {
  const navigate = useNavigate();

  if (!member) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center text-center border-2 border-red-400 dark:border-red-700">

        <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-5 ring-4 ring-red-200 dark:ring-red-800">
          <span
            className="material-symbols-outlined text-red-600 dark:text-red-400"
            style={{ fontSize: 56, fontVariationSettings: "'FILL' 1" }}
          >
            block
          </span>
        </div>

        <h2 className="text-2xl font-extrabold text-red-600 dark:text-red-400 mb-1 tracking-tight">
          Membership Expired
        </h2>
        <p className="text-on-surface font-bold text-xl mb-1">{member.name}</p>

        {member.expiryDate && (
          <p className="text-sm text-on-surface-variant mb-1">
            Expired on{' '}
            <span className="font-semibold text-red-500">{member.expiryDate}</span>
          </p>
        )}

        <p className="text-sm text-on-surface-variant mt-3 mb-8">
          Entry denied. Please renew the membership before allowing check-in.
        </p>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={() => { navigate(`/members/${member.id}`); onClose(); }}
            className="w-full bg-primary text-on-primary py-3.5 rounded-xl font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">autorenew</span>
            Renew Membership
          </button>
          <button
            onClick={onClose}
            className="w-full bg-surface-container text-on-surface-variant py-3 rounded-xl font-semibold hover:bg-surface-container-high transition-colors text-sm"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
