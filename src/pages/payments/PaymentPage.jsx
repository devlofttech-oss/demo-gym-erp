import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getTenantCollection, createTenantDocument, updateTenantDocument, getTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function PaymentPage() {
  const { gymId } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMemberId = searchParams.get('memberId') || '';

  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  const [planCategories, setPlanCategories] = useState([]);

  const [formData, setFormData] = useState({
    memberId: initialMemberId,
    planName: '',
    durationDays: 30,
    totalFees: 0,
    paidNow: '',
    paymentMode: 'Cash',
    planActiveFrom: today,
    expiryDate: addDays(today, 30),
    notes: '',
  });

  // Fully paid = member has a plan, has made at least one payment, and owes nothing
  const isFullyPaid = selectedMember !== null
    && Number(selectedMember.balanceFees || 0) === 0
    && Number(selectedMember.paidFees    || 0) > 0;

  // Base for balance: if member has existing outstanding balance use that, else use plan price
  const outstandingBase = selectedMember?.balanceFees > 0
    ? Number(selectedMember.balanceFees)
    : Number(formData.totalFees || 0);
  const balanceFees = Math.max(0, outstandingBase - Number(formData.paidNow || 0));

  // Load plan categories from settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const doc = await getTenantDocument(gymId, 'settings', 'general');
        if (doc && doc.categories && doc.categories.length > 0) {
          setPlanCategories(doc.categories);
          const firstCat = doc.categories[0];
          const firstPlan = firstCat?.plans?.[0];
          if (firstPlan && !initialMemberId) {
            setFormData(prev => ({
              ...prev,
              planName: `${firstCat.name} - ${firstPlan.name}`,
              durationDays: firstPlan.durationDays,
              totalFees: firstPlan.amount,
              expiryDate: addDays(prev.planActiveFrom, firstPlan.durationDays),
            }));
          }
        }
      } catch (error) {
        console.error('Failed to load plans', error);
      }
    };
    fetchSettings();
  }, []);

  // Recalculate expiry when planActiveFrom or durationDays changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      expiryDate: addDays(prev.planActiveFrom, prev.durationDays),
    }));
  }, [formData.planActiveFrom, formData.durationDays]);

  // Load members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await getTenantCollection(gymId, 'members');
        setMembers(data);
      } catch (error) {
        console.error(error);
        toast.error('Failed to load members');
      } finally {
        setLoadingMembers(false);
      }
    };
    fetchMembers();
  }, []);

  // Auto-select member if passed via URL param
  useEffect(() => {
    if (initialMemberId && members.length > 0) {
      loadMemberDetails(initialMemberId, members);
    }
  }, [initialMemberId, members, planCategories]);

  const loadMemberDetails = (memberId, memberList = members) => {
    const member = memberList.find(m => m.id === memberId);
    if (!member) return;
    setSelectedMember(member);

    const memberIsFullyPaid = Number(member.balanceFees || 0) === 0 && Number(member.paidFees || 0) > 0;

    if (!memberIsFullyPaid) {
      // ── Outstanding balance: keep the existing plan & fees as-is ──────────
      // User is just paying down the remaining balance, not choosing a new plan.
      const durationDays = member.expiryDate && member.planActiveFrom
        ? Math.round((new Date(member.expiryDate) - new Date(member.planActiveFrom)) / (1000 * 60 * 60 * 24))
        : 30;
      setFormData(prev => ({
        ...prev,
        memberId,
        planName: member.planName || prev.planName,
        durationDays,
        planActiveFrom: member.planActiveFrom || today,
        expiryDate: member.expiryDate || addDays(today, durationDays),
        totalFees: Number(member.totalFees || 0),
        paidNow: '',
      }));
      return;
    }

    // ── Fully paid: renewal mode — find matching plan in settings ──────────
    let matchedPlan = null;
    let matchedPlanFullName = '';
    if (planCategories.length) {
      outer: for (const cat of planCategories) {
        for (const plan of cat.plans) {
          if (`${cat.name} - ${plan.name}` === member.planName) {
            matchedPlan = plan;
            matchedPlanFullName = `${cat.name} - ${plan.name}`;
            break outer;
          }
        }
      }
      // No exact match in settings → default to first plan
      if (!matchedPlan) {
        const firstCat = planCategories[0];
        const firstPlan = firstCat?.plans?.[0];
        if (firstPlan) {
          matchedPlan = firstPlan;
          matchedPlanFullName = `${firstCat.name} - ${firstPlan.name}`;
        }
      }
    }

    const planPrice    = matchedPlan ? Number(matchedPlan.amount || 0) : Number(member.totalFees || 0);
    const durationDays = matchedPlan ? Number(matchedPlan.durationDays || 30) : 30;
    const planFullName = matchedPlanFullName || member.planName || '';

    setFormData(prev => ({
      ...prev,
      memberId,
      planName: planFullName,
      durationDays,
      planActiveFrom: today,
      expiryDate: addDays(today, durationDays),
      totalFees: planPrice,
      paidNow: '',
    }));
  };

  const handleMemberChange = (e) => {
    const id = e.target.value;
    if (!id) {
      setSelectedMember(null);
      setFormData(prev => ({ ...prev, memberId: '', paidNow: '', totalFees: 0 }));
      return;
    }
    loadMemberDetails(id);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePlanChange = (e) => {
    const fullName = e.target.value;
    for (const cat of planCategories) {
      const plan = cat.plans.find(p => `${cat.name} - ${p.name}` === fullName);
      if (plan) {
        setFormData(prev => ({
          ...prev,
          planName: fullName,
          durationDays: plan.durationDays,
          totalFees: plan.amount,
          // Keep the already-set planActiveFrom (renewal date); recalculate expiry from it
          expiryDate: addDays(prev.planActiveFrom, plan.durationDays),
          paidNow: '',
        }));
        return;
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.memberId) { toast.error('Please select a member'); return; }
    if (!formData.paidNow || Number(formData.paidNow) < 0) { toast.error('Enter a valid paid amount'); return; }

    const paidAmount     = Number(formData.paidNow);
    const totalFees      = Number(formData.totalFees || 0);
    const currentBalance = selectedMember?.balanceFees > 0 ? Number(selectedMember.balanceFees) : totalFees;
    const newBalance     = Math.max(0, currentBalance - paidAmount);

    try {
      setSaving(true);

      await createTenantDocument(gymId, 'payments', {
        memberId: formData.memberId,
        memberName: selectedMember?.name || '',
        memberPhone: selectedMember?.phone || '',
        planName: formData.planName,
        planActiveFrom: formData.planActiveFrom,
        expiryDate: formData.expiryDate,
        totalFees,
        paidAmount,
        amount: paidAmount,
        balanceFees: newBalance,
        paymentMode: formData.paymentMode,
        notes: formData.notes,
        date: new Date().toISOString(),
        status: 'Paid',
      });

      await updateTenantDocument(gymId, 'members', formData.memberId, {
        planName: formData.planName,
        planActiveFrom: formData.planActiveFrom,
        expiryDate: formData.expiryDate,
        status: 'Active',
        totalFees,
        paidFees: (selectedMember?.paidFees || 0) + paidAmount,
        balanceFees: newBalance,
      });

      toast.success('Payment recorded!');
      navigate(`/members/${formData.memberId}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to process payment');
    } finally {
      setSaving(false);
    }
  };

  const daysRemaining = Math.round(
    (new Date(formData.expiryDate) - new Date(formData.planActiveFrom)) / (1000 * 60 * 60 * 24)
  );

  const paidNowNum   = Number(formData.paidNow   || 0);
  const totalFeesNum = Number(formData.totalFees || 0);

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/payments"
          className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center transition-colors text-on-surface"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div className="flex flex-col">
          <h1 className="font-h2 text-h2 text-on-surface">Record Payment</h1>
          <p className="text-sm text-on-surface-variant">Process a subscription payment and activate member plan</p>
        </div>
      </div>

      <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* Member Select */}
          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm text-on-surface">
              Select Member <span className="text-error">*</span>
            </label>
            <select
              required
              name="memberId"
              value={formData.memberId}
              onChange={handleMemberChange}
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none appearance-none"
            >
              <option value="">-- Choose Member --</option>
              {loadingMembers
                ? <option disabled>Loading...</option>
                : members.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.phone})</option>
                  ))
              }
            </select>
          </div>

          {/* Member Info Card */}
          {selectedMember && (
            <div className="rounded-xl border border-outline-variant/30 bg-surface-container overflow-hidden">
              <div className="px-4 py-3 bg-primary/5 border-b border-outline-variant/20 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>account_circle</span>
                <span className="font-semibold text-on-surface text-sm">{selectedMember.name}</span>
                <span className="text-on-surface-variant text-xs ml-1">· {selectedMember.phone}</span>
                <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                  selectedMember.status === 'Active'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                }`}>{selectedMember.status || 'Unknown'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-outline-variant/20">
                <div className="px-4 py-3">
                  <div className="text-xs text-on-surface-variant mb-0.5">Current Plan</div>
                  <div className="text-sm font-medium text-on-surface truncate">{selectedMember.planName || '—'}</div>
                </div>
                <div className="px-4 py-3">
                  <div className="text-xs text-on-surface-variant mb-0.5">Expiry</div>
                  <div className="text-sm font-medium text-on-surface">{selectedMember.expiryDate || '—'}</div>
                </div>
                <div className="px-4 py-3">
                  <div className="text-xs text-on-surface-variant mb-0.5">Outstanding</div>
                  <div className={`text-sm font-bold ${
                    (selectedMember.balanceFees || 0) > 0 ? 'text-rose-500' : 'text-green-600'
                  }`}>
                    {(selectedMember.balanceFees || 0) > 0
                      ? `₹${Number(selectedMember.balanceFees).toLocaleString('en-IN')}`
                      : 'Cleared'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fully Paid Banner */}
          {isFullyPaid && (
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <div className="flex-1">
                <p className="font-semibold text-green-700 dark:text-green-400 text-sm">Fees Fully Paid</p>
                <p className="text-xs text-green-600/80 dark:text-green-500/80 mt-0.5">
                  This member has no outstanding balance. Select a new plan below to record a renewal.
                </p>
              </div>
            </div>
          )}

          <div className="border-t border-outline-variant/20" />

          {/* Plan + Fees */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">card_membership</span>
              Plan Details
            </h2>
            <div className="flex flex-col gap-4">

              {/* Plan — locked when member has outstanding balance */}
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface flex items-center gap-2">
                  Membership Plan
                  {selectedMember && !isFullyPaid && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-normal">
                      <span className="material-symbols-outlined text-[12px]">lock</span>
                      Locked — clear balance first
                    </span>
                  )}
                </label>
                {selectedMember && !isFullyPaid ? (
                  <div className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/20 rounded-lg text-on-surface-variant text-sm font-semibold select-none flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">card_membership</span>
                    {formData.planName || '—'}
                  </div>
                ) : (
                  <select
                    name="planName"
                    value={formData.planName}
                    onChange={handlePlanChange}
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none appearance-none"
                  >
                    {planCategories.map(cat => (
                      <optgroup key={cat.id} label={cat.name}>
                        {cat.plans.map(p => {
                          const fullName = `${cat.name} - ${p.name}`;
                          return (
                            <option key={fullName} value={fullName}>
                              {p.name}{p.amount > 0 ? ` — ₹${Number(p.amount).toLocaleString('en-IN')}` : ''}
                            </option>
                          );
                        })}
                      </optgroup>
                    ))}
                  </select>
                )}
              </div>

              {/* Fees Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Total Fees — read-only, fixed to plan price */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-sm text-on-surface">Total Fees (₹)</label>
                  <div className="w-full px-3 py-2.5 bg-surface-container border border-outline-variant/20 rounded-lg text-on-surface-variant text-sm font-semibold select-none">
                    {Number(formData.totalFees) > 0 ? `₹${Number(formData.totalFees).toLocaleString('en-IN')}` : '—'}
                  </div>
                  <span className="text-xs text-on-surface-variant">Plan price</span>
                </div>

                {/* Paid Fees */}
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

                {/* Balance Fees */}
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

              {/* Payment Mode + Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="flex flex-col gap-2">
                  <label className="font-medium text-sm text-on-surface">Notes (optional)</label>
                  <input
                    type="text"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="e.g. Renewal, Annual offer"
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-outline-variant/20" />

          {/* Plan Duration */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">calendar_month</span>
              Plan Duration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">
                  Plan Active From
                  <span className="ml-1 text-xs text-on-surface-variant font-normal">(plan starts this date)</span>
                </label>
                <input
                  type="date"
                  name="planActiveFrom"
                  value={formData.planActiveFrom}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">
                  Expiry Date
                  <span className="ml-1 text-xs text-on-surface-variant font-normal">(auto-calculated)</span>
                </label>
                <input
                  type="date"
                  name="expiryDate"
                  value={formData.expiryDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none"
                />
              </div>
            </div>
          </div>

          {/* Summary Banner */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-4">
            <span className="material-symbols-outlined text-primary text-2xl mt-0.5">receipt_long</span>
            <div className="flex-1 flex flex-col gap-1">
              <p className="text-sm font-semibold text-on-surface">
                Payment Summary
              </p>
              <div className="flex flex-wrap gap-4 mt-1 text-sm">
                <div>
                  <span className="text-on-surface-variant">Outstanding:</span>{' '}
                  <span className="font-semibold text-on-surface">₹{outstandingBase.toLocaleString('en-IN')}</span>
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
                Plan: {formData.planActiveFrom} → {formData.expiryDate} ({daysRemaining} days) · {formData.paymentMode}
              </p>
            </div>
          </div>

          <div className="border-t border-outline-variant/30 pt-6 flex justify-end gap-3">
            <Link
              to="/payments"
              className="px-5 py-2.5 rounded-lg text-on-surface-variant font-medium hover:bg-surface-container transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || loadingMembers || (isFullyPaid && outstandingBase === 0)}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  Processing...
                </>
              ) : isFullyPaid && outstandingBase === 0 ? (
                <>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Fully Paid
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                  Record Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
