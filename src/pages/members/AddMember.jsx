import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTenantCollection, createTenantDocument } from '../../firebase/tenantDb';
import toast from 'react-hot-toast';
import PhotoUpload from '../../components/ui/PhotoUpload';

const TYPE_LABELS = {
  'gym': 'Gym',
  'personal-training': 'Personal Training',
  'group-class': 'Group Class',
  'addon': 'Add-on',
};

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Returns the last day of the Nth calendar month from startDate
// e.g. Jan 1 + 12 months → Dec 31 (access through end of December)
function addMonthsEnd(dateStr, months) {
  const d = new Date(dateStr);
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(0);
  return d.toISOString().split('T')[0];
}

const FITNESS_GOALS = ['Weight Loss', 'Muscle Gain', 'General Fitness', 'Stamina', 'Flexibility', 'Rehabilitation'];

export default function AddMember() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { gymId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const [plans, setPlans] = useState([]);

  const [formData, setFormData] = useState({
    name: searchParams.get('name') || '',
    phone: searchParams.get('phone') || '',
    email: searchParams.get('email') || '',
    joinDate: today,
    planActiveFrom: today,
    planName: searchParams.get('plan') || '',
    durationDays: 30,
    durationMonths: 1,
    totalFees: 0,
    discountPercent: '',
    nextPaymentDays: '',
    paidNow: '',
    paymentMode: 'Cash',
    expiryDate: addDays(today, 30),
    emergencyContact: '',
    fitnessGoal: '',
    healthNotes: '',
  });

  const basePlanFees = Number(formData.totalFees || 0);
  const discountPct = Math.min(100, Math.max(0, Number(formData.discountPercent || 0)));
  const discountedTotal = Math.round(basePlanFees * (1 - discountPct / 100));
  const balanceFees = Math.max(0, discountedTotal - Number(formData.paidNow || 0));

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await getTenantCollection(gymId, 'plans');
        const active = data.filter(p => p.isActive !== false);
        setPlans(active);
        const first = active[0];
        if (first) {
          const months = first.durationMonths || 1;
          const days = months * 30;
          setFormData(prev => ({
            ...prev,
            planName: first.name,
            durationDays: days,
            durationMonths: months,
            totalFees: first.price || 0,
            expiryDate: addMonthsEnd(prev.planActiveFrom, months),
          }));
        }
      } catch (error) {
        console.error('Failed to load plans', error);
      }
    };
    fetchPlans();
  }, []);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      expiryDate: prev.durationMonths
        ? addMonthsEnd(prev.planActiveFrom, prev.durationMonths)
        : addDays(prev.planActiveFrom, prev.durationDays),
    }));
  }, [formData.planActiveFrom, formData.durationDays, formData.durationMonths]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePlanChange = (e) => {
    const planId = e.target.value;
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      const months = plan.durationMonths || 1;
      const days = months * 30;
      setFormData(prev => ({
        ...prev,
        planName: plan.name,
        durationDays: days,
        durationMonths: months,
        totalFees: plan.price || 0,
        discountPercent: '',
        paidNow: '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.phone) { toast.error('Phone number is required'); return; }

    const discount   = Math.min(100, Math.max(0, Number(formData.discountPercent || 0)));
    const totalFees  = Math.round(Number(formData.totalFees || 0) * (1 - discount / 100));
    const paidAmount = Number(formData.paidNow   || 0);
    const balance    = Math.max(0, totalFees - paidAmount);
    const nextPaymentDate = formData.nextPaymentDays
      ? addDays(formData.joinDate, Number(formData.nextPaymentDays))
      : null;

    try {
      setLoading(true);

      const memberDoc = await createTenantDocument(gymId, 'members', {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        joinDate: formData.joinDate,
        planName: formData.planName,
        planActiveFrom: formData.planActiveFrom,
        expiryDate: formData.expiryDate,
        status: 'Active',
        totalFees,
        paidFees: paidAmount,
        balanceFees: balance,
        ...(discount > 0 && { discountPercent: discount }),
        ...(nextPaymentDate && { nextPaymentDate }),
        ...(photoUrl && { photoUrl }),
        ...(formData.emergencyContact && { emergencyContact: formData.emergencyContact }),
        ...(formData.fitnessGoal && { fitnessGoal: formData.fitnessGoal }),
        ...(formData.healthNotes && { healthNotes: formData.healthNotes }),
      });

      await createTenantDocument(gymId, 'payments', {
        memberId: memberDoc.id,
        memberName: formData.name,
        memberPhone: formData.phone,
        planName: formData.planName,
        planActiveFrom: formData.planActiveFrom,
        expiryDate: formData.expiryDate,
        totalFees,
        paidAmount,
        balanceFees: balance,
        amount: paidAmount,
        paymentMode: formData.paymentMode,
        date: new Date().toISOString(),
        status: 'Paid',
      });

      toast.success('Member added & payment recorded!');
      navigate(`/members/${memberDoc.id}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const daysUntilExpiry = Math.round(
    (new Date(formData.expiryDate) - new Date(formData.planActiveFrom)) / (1000 * 60 * 60 * 24)
  );

  const paidNowNum   = Number(formData.paidNow   || 0);
  const discountSavings = basePlanFees - discountedTotal;
  const nextPaymentDate = formData.nextPaymentDays
    ? addDays(formData.joinDate, Number(formData.nextPaymentDays))
    : null;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/members"
          className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center transition-colors text-on-surface"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div className="flex flex-col">
          <h1 className="font-h2 text-h2 text-on-surface">Add New Member</h1>
          <p className="text-sm text-on-surface-variant">Register a new member and record their first payment</p>
        </div>
      </div>

      <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* Personal Details */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">person</span>
              Personal Details
            </h2>

            {/* Photo */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-20 h-20 rounded-full bg-primary-container text-primary flex items-center justify-center text-2xl font-bold shrink-0 overflow-hidden border-2 border-outline-variant/20">
                {photoUrl
                  ? <img src={photoUrl} alt="preview" className="w-full h-full object-cover" />
                  : (formData.name ? formData.name.charAt(0).toUpperCase() : <span className="material-symbols-outlined text-[28px] opacity-50">person</span>)
                }
              </div>
              <div className="flex flex-col gap-1">
                <PhotoUpload onUpload={(url) => setPhotoUrl(url)} />
                {photoUrl && (
                  <button type="button" onClick={() => setPhotoUrl('')} className="text-xs text-rose-500 hover:text-rose-600 text-left transition-colors">
                    Remove photo
                  </button>
                )}
                <p className="text-xs text-on-surface-variant">Optional — JPG, PNG up to 5 MB</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Full Name <span className="text-error">*</span></label>
                <input
                  required
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Phone Number <span className="text-error">*</span></label>
                <input
                  required
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. 9876543210"
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Email (optional)</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g. rahul@email.com"
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Date of Joining</label>
                <input
                  type="date"
                  name="joinDate"
                  value={formData.joinDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Emergency Contact</label>
                <input
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleChange}
                  placeholder="Name & phone of emergency contact"
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Fitness Goal</label>
                <select
                  name="fitnessGoal"
                  value={formData.fitnessGoal}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none appearance-none"
                >
                  <option value="">Select goal...</option>
                  {FITNESS_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Health Notes (optional)</label>
                <input
                  name="healthNotes"
                  value={formData.healthNotes}
                  onChange={handleChange}
                  placeholder="Any health conditions, injuries, or special requirements..."
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-outline-variant/20" />

          {/* Plan & Payment */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">card_membership</span>
              Plan & Payment
            </h2>
            <div className="flex flex-col gap-4">

              {/* Plan dropdown */}
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">
                  Membership Plan
                  {plans.length === 0 && (
                    <Link to="/plans" className="ml-2 text-xs text-primary underline font-normal">Add plans first</Link>
                  )}
                </label>
                <select
                  name="planName"
                  value={plans.find(p => p.name === formData.planName)?.id || ''}
                  onChange={handlePlanChange}
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none appearance-none"
                >
                  {plans.length === 0 && <option value="">No plans — go to Settings &gt; Plans</option>}
                  {Object.entries(TYPE_LABELS).map(([type, label]) => {
                    const group = plans.filter(p => p.type === type);
                    if (!group.length) return null;
                    return (
                      <optgroup key={type} label={label}>
                        {group.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.price > 0 ? ` — ₹${Number(p.price).toLocaleString('en-IN')}` : ''}
                            {p.durationMonths ? ` (${p.durationMonths}m)` : p.sessions ? ` (${p.sessions} sessions)` : ''}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              {/* Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-sm text-on-surface">Discount (%)</label>
                  <input
                    type="number"
                    name="discountPercent"
                    value={formData.discountPercent}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    placeholder="0"
                    className="w-full px-3 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none text-sm"
                  />
                  <span className="text-xs text-on-surface-variant">
                    {discountPct > 0 ? `Save ₹${discountSavings.toLocaleString('en-IN')}` : 'Optional discount'}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-sm text-on-surface">Next Payment (days)</label>
                  <input
                    type="number"
                    name="nextPaymentDays"
                    value={formData.nextPaymentDays}
                    onChange={handleChange}
                    min="1"
                    placeholder="e.g. 30"
                    className="w-full px-3 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none text-sm"
                  />
                  <span className="text-xs text-on-surface-variant">
                    {nextPaymentDate ? `Due by: ${nextPaymentDate}` : 'Grace period (optional)'}
                  </span>
                </div>
              </div>

              {/* Fees row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Total Fees — read-only */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-sm text-on-surface">Total Fees (₹)</label>
                  <div className="w-full px-3 py-2.5 bg-surface-container border border-outline-variant/20 rounded-lg text-on-surface-variant text-sm font-semibold select-none">
                    {discountPct > 0 ? (
                      <span>
                        <span className="line-through opacity-50 mr-1.5">₹{basePlanFees.toLocaleString('en-IN')}</span>
                        <span className="text-primary">₹{discountedTotal.toLocaleString('en-IN')}</span>
                      </span>
                    ) : (
                      basePlanFees > 0 ? `₹${basePlanFees.toLocaleString('en-IN')}` : '—'
                    )}
                  </div>
                  <span className="text-xs text-on-surface-variant">
                    {discountPct > 0 ? `After ${discountPct}% discount` : 'Plan price'}
                  </span>
                </div>

                {/* Paid Fees — editable */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-sm text-on-surface">
                    Paid Fees (₹) <span className="text-error">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    name="paidNow"
                    value={formData.paidNow}
                    onChange={handleChange}
                    min="0"
                    placeholder="0"
                    className="w-full px-3 py-2.5 bg-surface-container border border-primary/50 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none text-sm"
                  />
                  <span className="text-xs text-on-surface-variant">Paying now</span>
                </div>

                {/* Balance Fees — auto */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-sm text-on-surface">Balance Fees (₹)</label>
                  <div className={`w-full px-3 py-2.5 rounded-lg border text-sm font-semibold ${
                    balanceFees > 0
                      ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400'
                      : 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                  }`}>
                    ₹{balanceFees.toLocaleString('en-IN')}
                  </div>
                  <span className="text-xs text-on-surface-variant">Remaining dues</span>
                </div>
              </div>

              {/* Dates + Payment Mode */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="font-medium text-sm text-on-surface">Plan Active From</label>
                  <input
                    type="date"
                    name="planActiveFrom"
                    value={formData.planActiveFrom}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-medium text-sm text-on-surface">Expiry Date</label>
                  <input
                    type="date"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-medium text-sm text-on-surface">Payment Mode</label>
                  <select
                    name="paymentMode"
                    value={formData.paymentMode}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none appearance-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Banner */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-4">
            <span className="material-symbols-outlined text-primary text-2xl mt-0.5">receipt_long</span>
            <div className="flex-1 flex flex-col gap-1">
              <p className="text-sm font-semibold text-on-surface">Payment Summary</p>
              <div className="flex flex-wrap gap-4 mt-1 text-sm">
                <div>
                  <span className="text-on-surface-variant">Total:</span>{' '}
                  <span className="font-semibold text-on-surface">₹{discountedTotal.toLocaleString('en-IN')}</span>
                  {discountPct > 0 && (
                    <span className="ml-1.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full font-medium">
                      -{discountPct}%
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-on-surface-variant">Paying:</span>{' '}
                  <span className="font-semibold text-primary">₹{paidNowNum.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant">Balance:</span>{' '}
                  <span className={`font-semibold ${balanceFees > 0 ? 'text-rose-500' : 'text-green-600'}`}>
                    ₹{balanceFees.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                Plan: {formData.planActiveFrom} → {formData.expiryDate} ({daysUntilExpiry} days) · {formData.paymentMode}
                {nextPaymentDate && ` · Next payment by: ${nextPaymentDate}`}
              </p>
            </div>
          </div>

          <div className="border-t border-outline-variant/30 pt-6 flex justify-end gap-3">
            <Link to="/members" className="px-5 py-2.5 rounded-lg text-on-surface-variant font-medium hover:bg-surface-container transition-colors">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  Add Member & Record Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
