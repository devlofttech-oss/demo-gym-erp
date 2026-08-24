import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTenantDocument, getTenantCollection, createTenantDocument, updateTenantDocument } from '../../firebase/tenantDb';
import toast from 'react-hot-toast';
import PhotoUpload from '../../components/ui/PhotoUpload';
import MemberQRModal from '../../components/ui/MemberQRModal';
import { uploadMemberPhoto } from '../../utils/imagekit';

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

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return d.toISOString().split('T')[0];
}

const FITNESS_GOALS = ['Weight Loss', 'Muscle Gain', 'General Fitness', 'Stamina', 'Flexibility', 'Rehabilitation'];

export default function AddMember() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const { gymId, gymData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [createdMember, setCreatedMember] = useState(null); // triggers the QR share modal
  const [loadingMember, setLoadingMember] = useState(isEdit);
  const [photoUrl, setPhotoUrl] = useState('');        // existing photo (edit mode) or after save
  const [photoFile, setPhotoFile] = useState(null);    // newly picked file, uploaded only on save
  const [photoPreview, setPhotoPreview] = useState(''); // local object URL for instant preview
  const [existingCredit, setExistingCredit] = useState(0); // paidFees already on account

  // Deferred photo handling — the file is NOT uploaded to ImageKit until the member is
  // actually saved, so abandoning the form never leaves an orphaned image.
  const handleSelectPhoto = (file) => {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };
  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setPhotoUrl('');
  };
  // Revoke the object URL when it changes or the form unmounts.
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const today = new Date().toISOString().split('T')[0];

  const [plans, setPlans] = useState([]);

  const [formData, setFormData] = useState({
    name: searchParams.get('name') || '',
    phone: searchParams.get('phone') || '',
    email: searchParams.get('email') || '',
    joinDate: today,
    birthday: '',
    planActiveFrom: today,
    planName: searchParams.get('plan') || '',
    durationDays: 30,
    durationMonths: 1,
    totalFees: 0,
    joiningFees: '',
    discountPercent: '',
    discountAmount: '',
    nextPaymentDays: '',
    paidNow: '',
    paymentMode: 'Cash',
    expiryDate: addMonths(today, 1),
    emergencyContact: '',
    fitnessGoal: '',
    healthNotes: '',
  });

  const basePlanFees    = Number(formData.totalFees || 0);
  const joiningFeesAmt  = Number(formData.joiningFees || 0);
  const discountAmt     = Math.min(basePlanFees, Math.max(0, Number(formData.discountAmount || 0)));
  const discountPct     = basePlanFees > 0 ? +((discountAmt / basePlanFees) * 100).toFixed(1) : 0;
  const discountedTotal = Math.max(0, basePlanFees - discountAmt);
  const finalTotal      = discountedTotal + joiningFeesAmt;
  const paidNowNum      = Number(formData.paidNow || 0);
  const netPaid         = existingCredit + paidNowNum;
  const balanceFees     = Math.max(0, finalTotal - netPaid);

  const handleDiscountPercent = (val) => {
    const pct = Math.min(100, Math.max(0, Number(val) || 0));
    const amt = basePlanFees > 0 ? Math.round(basePlanFees * pct / 100) : 0;
    setFormData(prev => ({ ...prev, discountPercent: val, discountAmount: amt > 0 ? amt : '' }));
  };
  const handleDiscountAmount = (val) => {
    const amt = Math.min(basePlanFees, Math.max(0, Number(val) || 0));
    const pct = basePlanFees > 0 ? +((amt / basePlanFees) * 100).toFixed(1) : 0;
    setFormData(prev => ({ ...prev, discountAmount: val, discountPercent: pct > 0 ? pct : '' }));
  };

  // Load plans
  useEffect(() => {
    if (!gymId) return;
    getTenantCollection(gymId, 'plans')
      .then(data => {
        const active = data.filter(p => p.isActive !== false);
        setPlans(active);
        // Only auto-select first plan when adding (not editing — member already has one)
        if (!isEdit && active.length > 0) {
          const first = active[0];
          const months = first.durationMonths || 1;
          setFormData(prev => ({
            ...prev,
            planName: prev.planName || first.name,
            durationMonths: months,
            durationDays: months * 30,
            totalFees: first.price || 0,
            expiryDate: addMonths(prev.planActiveFrom, months),
          }));
        }
      })
      .catch(console.error);
  }, [gymId, isEdit]);

  // Load existing member when editing
  useEffect(() => {
    if (!isEdit || !gymId) return;
    setLoadingMember(true);
    getTenantDocument(gymId, 'members', editId)
      .then(member => {
        if (!member) { toast.error('Member not found'); return; }
        setPhotoUrl(member.photoUrl || '');
        setExistingCredit(Number(member.paidFees || 0));
        setFormData(prev => ({
          ...prev,
          name:             member.name || '',
          phone:            member.phone || '',
          email:            member.email || '',
          joinDate:         member.joinDate || today,
          birthday:         member.birthday || '',
          planActiveFrom:   member.planActiveFrom || today,
          planName:         member.planName || '',
          expiryDate:       member.expiryDate || today,
          emergencyContact: member.emergencyContact || '',
          fitnessGoal:      member.fitnessGoal || '',
          healthNotes:      member.healthNotes || '',
          // Don't pre-fill fees — admin will pick new plan or keep existing
        }));
      })
      .catch(console.error)
      .finally(() => setLoadingMember(false));
  }, [isEdit, editId, gymId]);

  // Recalculate expiry when start date or plan duration changes
  useEffect(() => {
    if (formData.durationMonths) {
      setFormData(prev => ({
        ...prev,
        expiryDate: addMonths(prev.planActiveFrom, prev.durationMonths),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        expiryDate: addDays(prev.planActiveFrom, prev.durationDays),
      }));
    }
  }, [formData.planActiveFrom, formData.durationDays, formData.durationMonths]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePlanChange = (e) => {
    const plan = plans.find(p => p.id === e.target.value);
    if (!plan) return;
    const months = plan.durationMonths || 1;
    setFormData(prev => ({
      ...prev,
      planName:      plan.name,
      durationDays:  months * 30,
      durationMonths: months,
      totalFees:     plan.price || 0,
      discountPercent: '',
      discountAmount: '',
      paidNow:       '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.phone) { toast.error('Phone number is required'); return; }

    const discountAmtSubmit = Math.min(basePlanFees, Math.max(0, Number(formData.discountAmount || 0)));
    const discountPctSubmit = basePlanFees > 0 ? +((discountAmtSubmit / basePlanFees) * 100).toFixed(1) : 0;
    const joiningFees       = Number(formData.joiningFees || 0);
    const totalFees         = Math.max(0, basePlanFees - discountAmtSubmit) + joiningFees;
    const paidNow       = Number(formData.paidNow || 0);
    const newPaidFees   = isEdit ? existingCredit + paidNow : paidNow;
    const balance       = Math.max(0, totalFees - newPaidFees);
    const nextPaymentDate = formData.nextPaymentDays
      ? addDays(formData.joinDate, Number(formData.nextPaymentDays))
      : null;

    try {
      setLoading(true);

      // Upload the photo now (only if one was picked) — deferred so an abandoned
      // form never creates an orphaned ImageKit file.
      let finalPhotoUrl = photoUrl;
      if (photoFile) {
        try {
          finalPhotoUrl = await uploadMemberPhoto(photoFile);
        } catch (err) {
          toast.error(err?.message ? `Photo upload failed: ${err.message}` : 'Photo upload failed');
          setLoading(false);
          return;
        }
      }

      const memberData = {
        name:             formData.name,
        phone:            formData.phone,
        email:            formData.email,
        joinDate:         formData.joinDate,
        ...(formData.birthday && { birthday: formData.birthday }),
        planName:         formData.planName,
        planActiveFrom:   formData.planActiveFrom,
        expiryDate:       formData.expiryDate,
        status:           'Active',
        totalFees,
        paidFees:         newPaidFees,
        balanceFees:      balance,
        ...(joiningFees > 0 && { joiningFees }),
        ...(discountAmtSubmit > 0 && { discountAmount: discountAmtSubmit, discountPercent: discountPctSubmit }),
        ...(nextPaymentDate && { nextPaymentDate }),
        ...(finalPhotoUrl && { photoUrl: finalPhotoUrl }),
        ...(formData.emergencyContact && { emergencyContact: formData.emergencyContact }),
        ...(formData.fitnessGoal && { fitnessGoal: formData.fitnessGoal }),
        ...(formData.healthNotes && { healthNotes: formData.healthNotes }),
      };

      let memberId = editId;

      if (isEdit) {
        await updateTenantDocument(gymId, 'members', editId, memberData);
        // Only record a payment if something was actually paid today
        if (paidNow > 0) {
          await createTenantDocument(gymId, 'payments', {
            memberId: editId,
            memberName:    formData.name,
            memberPhone:   formData.phone,
            planName:      formData.planName,
            planActiveFrom: formData.planActiveFrom,
            expiryDate:    formData.expiryDate,
            totalFees,
            paidAmount:    paidNow,
            amount:        paidNow,
            balanceFees:   balance,
            paymentMode:   formData.paymentMode,
            date:          new Date().toISOString(),
            status:        'Paid',
            ...(existingCredit > 0 && { creditApplied: existingCredit }),
          });
        }
        toast.success('Member updated!');
      } else {
        const memberDoc = await createTenantDocument(gymId, 'members', memberData);
        memberId = memberDoc.id;
        await createTenantDocument(gymId, 'payments', {
          memberId:      memberDoc.id,
          memberName:    formData.name,
          memberPhone:   formData.phone,
          planName:      formData.planName,
          planActiveFrom: formData.planActiveFrom,
          expiryDate:    formData.expiryDate,
          totalFees,
          paidAmount:    paidNow,
          amount:        paidNow,
          balanceFees:   balance,
          paymentMode:   formData.paymentMode,
          date:          new Date().toISOString(),
          status:        'Paid',
        });
        toast.success('Member added & payment recorded!');
      }

      if (isEdit) {
        navigate(`/members/${memberId}`);
      } else {
        // Show the QR share modal; navigation happens when it's dismissed.
        setCreatedMember({ id: memberId, name: formData.name, phone: formData.phone });
      }
    } catch (error) {
      console.error(error);
      toast.error(isEdit ? 'Failed to update member' : 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const daysUntilExpiry = Math.round(
    (new Date(formData.expiryDate) - new Date(formData.planActiveFrom)) / (1000 * 60 * 60 * 24)
  );
  const nextPaymentDate = formData.nextPaymentDays
    ? addDays(formData.joinDate, Number(formData.nextPaymentDays))
    : null;

  if (loadingMember) {
    return (
      <div className="flex items-center justify-center py-24 text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-2xl mr-2">progress_activity</span>
        Loading member...
      </div>
    );
  }

  const inp = 'w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none';

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      {createdMember && (
        <MemberQRModal
          member={createdMember}
          gymName={gymData?.name}
          onClose={() => navigate(`/members/${createdMember.id}`)}
        />
      )}
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to={isEdit ? `/members/${editId}` : '/members'}
          className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center transition-colors text-on-surface"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div className="flex flex-col">
          <h1 className="font-h2 text-h2 text-on-surface">
            {isEdit ? 'Edit Member' : 'Add New Member'}
          </h1>
          <p className="text-sm text-on-surface-variant">
            {isEdit ? 'Update member details and assign a new plan' : 'Register a new member and record their first payment'}
          </p>
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
                {(photoPreview || photoUrl)
                  ? <img src={photoPreview || photoUrl} alt="preview" className="w-full h-full object-cover" />
                  : (formData.name ? formData.name.charAt(0).toUpperCase() : <span className="material-symbols-outlined text-[28px] opacity-50">person</span>)
                }
              </div>
              <div className="flex flex-col gap-1">
                <PhotoUpload onSelectFile={handleSelectPhoto} label="Choose Photo" />
                {(photoPreview || photoUrl) && (
                  <button type="button" onClick={removePhoto} className="text-xs text-rose-500 hover:text-rose-600 text-left transition-colors">
                    Remove photo
                  </button>
                )}
                <p className="text-xs text-on-surface-variant">Optional — uploaded when you save. JPG, PNG up to 5 MB</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Full Name <span className="text-error">*</span></label>
                <input required name="name" value={formData.name} onChange={handleChange}
                  placeholder="e.g. Rahul Sharma" className={inp} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Phone Number <span className="text-error">*</span></label>
                <input required type="tel" name="phone" value={formData.phone} onChange={handleChange}
                  placeholder="e.g. 9876543210" className={inp} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Email (optional)</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange}
                  placeholder="e.g. rahul@email.com" className={inp} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Date of Joining</label>
                <input type="date" name="joinDate" value={formData.joinDate} onChange={handleChange} className={inp} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Date of Birth</label>
                <input type="date" name="birthday" value={formData.birthday} onChange={handleChange} className={inp} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Emergency Contact</label>
                <input name="emergencyContact" value={formData.emergencyContact} onChange={handleChange}
                  placeholder="Name & phone of emergency contact" className={inp} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Fitness Goal</label>
                <select name="fitnessGoal" value={formData.fitnessGoal} onChange={handleChange}
                  className={inp + ' appearance-none'}>
                  <option value="">Select goal...</option>
                  {FITNESS_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Health Notes (optional)</label>
                <input name="healthNotes" value={formData.healthNotes} onChange={handleChange}
                  placeholder="Any health conditions, injuries, or special requirements..." className={inp} />
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
                  value={plans.find(p => p.name === formData.planName)?.id || ''}
                  onChange={handlePlanChange}
                  className={inp + ' appearance-none'}
                >
                  {plans.length === 0 && <option value="">No plans — go to Settings › Plans</option>}
                  {isEdit && formData.planName && !plans.find(p => p.name === formData.planName) && (
                    <option value="" disabled>{formData.planName} (current)</option>
                  )}
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

              {/* Plan carry-forward banner (edit mode only) */}
              {isEdit && existingCredit > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-xl p-4 flex items-start gap-3">
                  <span className="material-symbols-outlined text-emerald-600 text-[20px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>savings</span>
                  <div className="flex flex-col gap-1 text-sm">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300">Carry-forward credit</p>
                    <p className="text-emerald-700 dark:text-emerald-400">
                      ₹{existingCredit.toLocaleString('en-IN')} already paid on previous plan will be credited to the new plan.
                    </p>
                    {finalTotal > 0 && (
                      <p className="text-emerald-700 dark:text-emerald-400">
                        Net to collect today:{' '}
                        <strong>₹{Math.max(0, finalTotal - existingCredit).toLocaleString('en-IN')}</strong>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Joining Fees */}
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-sm text-on-surface">Joining Fees (₹)</label>
                <input type="number" name="joiningFees" value={formData.joiningFees}
                  onChange={handleChange} min="0" placeholder="0"
                  className="w-full px-3 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                <span className="text-xs text-on-surface-variant">One-time joining fee (added to total)</span>
              </div>

              {/* Discount */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-sm text-on-surface">Discount (%)</label>
                  <input type="number" value={formData.discountPercent}
                    onChange={e => handleDiscountPercent(e.target.value)}
                    min="0" max="100" placeholder="0"
                    className="w-full px-3 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <span className="text-xs text-on-surface-variant">Percentage off</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-sm text-on-surface">Discount (₹)</label>
                  <input type="number" value={formData.discountAmount}
                    onChange={e => handleDiscountAmount(e.target.value)}
                    min="0" placeholder="0"
                    className="w-full px-3 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <span className="text-xs text-on-surface-variant">
                    {discountAmt > 0 ? `${discountPct}% off — save ₹${discountAmt.toLocaleString('en-IN')}` : 'Flat amount off'}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-sm text-on-surface">Next Payment (days)</label>
                  <input type="number" name="nextPaymentDays" value={formData.nextPaymentDays} onChange={handleChange}
                    min="1" placeholder="e.g. 30"
                    className="w-full px-3 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none text-sm" />
                  <span className="text-xs text-on-surface-variant">
                    {nextPaymentDate ? `Due by: ${nextPaymentDate}` : 'Grace period (optional)'}
                  </span>
                </div>
              </div>

              {/* Fees row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Total Fees */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-sm text-on-surface">Grand Total (₹)</label>
                  <div className="w-full px-3 py-2.5 bg-surface-container border border-outline-variant/20 rounded-lg text-on-surface-variant text-sm font-semibold select-none">
                    {discountAmt > 0 ? (
                      <span>
                        <span className="line-through opacity-50 mr-1.5">₹{(basePlanFees + joiningFeesAmt).toLocaleString('en-IN')}</span>
                        <span className="text-primary">₹{finalTotal.toLocaleString('en-IN')}</span>
                      </span>
                    ) : (
                      finalTotal > 0 ? `₹${finalTotal.toLocaleString('en-IN')}` : '—'
                    )}
                  </div>
                  <span className="text-xs text-on-surface-variant">
                    {joiningFeesAmt > 0
                      ? `Plan ₹${discountedTotal.toLocaleString('en-IN')} + Joining ₹${joiningFeesAmt.toLocaleString('en-IN')}`
                      : discountAmt > 0
                        ? `After ${discountPct}% (₹${discountAmt.toLocaleString('en-IN')}) discount`
                        : 'Plan price'}
                  </span>
                </div>

                {/* Paying Now */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-sm text-on-surface">
                    Paying Now (₹) {!isEdit && <span className="text-error">*</span>}
                  </label>
                  <input
                    required={!isEdit}
                    type="number"
                    name="paidNow"
                    value={formData.paidNow}
                    onChange={handleChange}
                    min="0"
                    placeholder={isEdit ? '0' : '0'}
                    className="w-full px-3 py-2.5 bg-surface-container border border-primary/50 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none text-sm"
                  />
                  <span className="text-xs text-on-surface-variant">
                    {isEdit && existingCredit > 0 ? `+ ₹${existingCredit.toLocaleString('en-IN')} credit` : 'Cash collected today'}
                  </span>
                </div>

                {/* Balance */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-sm text-on-surface">Balance (₹)</label>
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
                  <input type="date" name="planActiveFrom" value={formData.planActiveFrom} onChange={handleChange} className={inp} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-medium text-sm text-on-surface">Expiry Date</label>
                  <input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleChange} className={inp} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-medium text-sm text-on-surface">Payment Mode</label>
                  <select name="paymentMode" value={formData.paymentMode} onChange={handleChange}
                    className={inp + ' appearance-none'}>
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
                  <span className="text-on-surface-variant">Grand total:</span>{' '}
                  <span className="font-semibold text-on-surface">₹{finalTotal.toLocaleString('en-IN')}</span>
                </div>
                {isEdit && existingCredit > 0 && (
                  <div>
                    <span className="text-on-surface-variant">Credit:</span>{' '}
                    <span className="font-semibold text-emerald-600">₹{existingCredit.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div>
                  <span className="text-on-surface-variant">Collecting:</span>{' '}
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
            <Link to={isEdit ? `/members/${editId}` : '/members'}
              className="px-5 py-2.5 rounded-lg text-on-surface-variant font-medium hover:bg-surface-container transition-colors">
              Cancel
            </Link>
            <button type="submit" disabled={loading}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2">
              {loading ? (
                <><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Saving...</>
              ) : isEdit ? (
                <><span className="material-symbols-outlined text-[18px]">save</span> Save Changes</>
              ) : (
                <><span className="material-symbols-outlined text-[18px]">person_add</span> Add Member & Record Payment</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
