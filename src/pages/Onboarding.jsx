import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createTenantDocument } from '../firebase/tenantDb';
import toast from 'react-hot-toast';

const STEPS = ['Add Plan', 'Add Member', 'View Dashboard'];

function StepBar({ step }) {
  return (
    <div className="bg-white border-b border-outline-variant/30 px-6 py-4">
      <div className="flex items-center max-w-sm mx-auto">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-sm font-bold
                ${i < step  ? 'bg-primary border-primary text-white'
                : i === step ? 'border-primary text-primary bg-white'
                              : 'border-outline-variant text-on-surface-variant bg-white'}`}>
                {i < step
                  ? <span className="material-symbols-outlined text-[15px]">check</span>
                  : i + 1}
              </div>
              <span className={`text-[10px] mt-1 font-medium whitespace-nowrap
                ${i <= step ? 'text-primary' : 'text-on-surface-variant'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 mb-5 ${i < step ? 'bg-primary' : 'bg-outline-variant/40'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InstructionRow({ num, title, sub }) {
  return (
    <div className="mb-3">
      <div className="text-sm font-semibold text-on-surface">{num} {title}</div>
      <div className="text-xs text-on-surface-variant">{sub}</div>
    </div>
  );
}

function FieldRow({ icon, children }) {
  return (
    <div className="flex items-center border border-outline-variant/50 rounded-xl overflow-hidden bg-surface-container focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
      <span className="material-symbols-outlined text-primary px-3 text-[20px] shrink-0">{icon}</span>
      {children}
    </div>
  );
}

export default function Onboarding() {
  const { gymId } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedPlan, setSavedPlan] = useState(null);
  const [fillTest, setFillTest] = useState(false);

  // Plan
  const [planName, setPlanName] = useState('');
  const [price, setPrice] = useState('');
  const [durUnit, setDurUnit] = useState('months');
  const [durVal, setDurVal] = useState('1');

  // Member
  const [memName, setMemName] = useState('');
  const [memPhone, setMemPhone] = useState('');

  const applyTestData = (forStep) => {
    if (forStep === 0) {
      setPlanName('6 Month Premium'); setPrice('5000'); setDurUnit('months'); setDurVal('6');
    } else {
      setMemName('Arjun Sharma'); setMemPhone('9876543210');
    }
  };

  const savePlan = async () => {
    if (!planName.trim()) { toast.error('Plan name is required'); return; }
    if (!price || Number(price) <= 0) { toast.error('Enter a valid price'); return; }
    setSaving(true);
    try {
      const payload = {
        name: planName.trim(),
        type: 'gym',
        price: Number(price),
        gstPercent: 0,
        description: '',
        features: [],
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      if (durUnit === 'months' && durVal) payload.durationMonths = Number(durVal);
      const plan = await createTenantDocument(gymId, 'plans', payload);
      setSavedPlan(plan);
      setStep(1);
    } catch {
      toast.error('Failed to save plan');
    }
    setSaving(false);
  };

  const saveMember = async () => {
    if (!memName.trim()) { toast.error('Member name is required'); return; }
    setSaving(true);
    try {
      await createTenantDocument(gymId, 'members', {
        name: memName.trim(),
        phone: memPhone.trim(),
        planId: savedPlan?.id || '',
        planName: savedPlan?.name || '',
        status: 'active',
        startDate: new Date().toISOString().slice(0, 10),
      });
      setStep(2);
    } catch {
      toast.error('Failed to save member');
    }
    setSaving(false);
  };

  const inputCls = 'flex-1 py-3 pr-4 bg-transparent outline-none text-sm text-on-surface placeholder:text-on-surface-variant/60';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-surface border-b border-outline-variant/30 px-5 py-3 flex items-center gap-3">
        <img src="/kilos_logo.png" alt="Kilos" className="w-8 h-8 rounded-lg" onError={e => { e.target.style.display='none'; }} />
        <span className="font-bold text-lg text-on-surface font-display">Kilos</span>
      </div>

      <StepBar step={step} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto p-4 space-y-4 pb-12">

          {/* ── Step 1: Add Plan ── */}
          {step === 0 && (
            <>
              <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4">
                <h2 className="text-lg font-bold text-on-surface">Add a Plan</h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  Create at least one membership plan so you can add members to it later.
                </p>
                <label className="flex items-center gap-3 mt-3 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => { const next = !fillTest; setFillTest(next); if (next) applyTestData(0); }}
                    className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${fillTest ? 'bg-primary' : 'bg-outline-variant'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${fillTest ? 'translate-x-4' : ''}`} />
                  </button>
                  <div>
                    <div className="font-semibold text-sm text-on-surface">Fill Test Data</div>
                    <div className="text-xs text-on-surface-variant">Use sample data to explore the app.</div>
                  </div>
                </label>
              </div>

              <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4">
                <h3 className="font-bold text-on-surface mb-3">Gym Plan Creation Instructions</h3>
                <InstructionRow num="1." title="Set plan name and price" sub='Example: "6 Month Premium" – 5000' />
                <InstructionRow num="2." title="Choose duration in months or days" sub="Example: 6 months or 180 days" />
                <InstructionRow num="3." title="These plans will be assigned to gym members" sub='Example: Assign "6 Month Premium" to new members' />
              </div>

              <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 space-y-3">
                <FieldRow icon="badge">
                  <input className={inputCls} placeholder="Plan Name *" value={planName} onChange={e => setPlanName(e.target.value)} />
                </FieldRow>
                <FieldRow icon="currency_rupee">
                  <input className={inputCls} placeholder="Price *" type="number" value={price} onChange={e => setPrice(e.target.value)} />
                </FieldRow>
                <div className="flex items-center gap-4 px-1">
                  <span className="material-symbols-outlined text-primary text-[20px]">schedule</span>
                  {['months', 'days'].map(u => (
                    <label key={u} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={durUnit === u} onChange={() => setDurUnit(u)}
                        className="accent-primary w-4 h-4" />
                      <span className="text-sm font-medium text-on-surface capitalize">{u}</span>
                    </label>
                  ))}
                </div>
                <FieldRow icon="calendar_month">
                  <input className={inputCls} placeholder={`Duration in ${durUnit}`} type="number"
                    value={durVal} onChange={e => setDurVal(e.target.value)} />
                  <span className="text-on-surface-variant text-sm pr-4">{durUnit}</span>
                </FieldRow>
              </div>

              <button onClick={savePlan} disabled={saving}
                className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl text-base transition-colors disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}

          {/* ── Step 2: Add Member ── */}
          {step === 1 && (
            <>
              <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4">
                <h2 className="text-lg font-bold text-on-surface">Add a Member</h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  Add your first gym member. You can skip this and add members later.
                </p>
                <label className="flex items-center gap-3 mt-3 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => { const next = !fillTest; setFillTest(next); if (next) applyTestData(1); }}
                    className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${fillTest ? 'bg-primary' : 'bg-outline-variant'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${fillTest ? 'translate-x-4' : ''}`} />
                  </button>
                  <div>
                    <div className="font-semibold text-sm text-on-surface">Fill Test Data</div>
                    <div className="text-xs text-on-surface-variant">Use sample data to explore the app.</div>
                  </div>
                </label>
              </div>

              {savedPlan && (
                <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                  <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                  <span className="text-sm font-semibold text-primary">Plan: {savedPlan.name}</span>
                </div>
              )}

              <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 space-y-3">
                <FieldRow icon="person">
                  <input className={inputCls} placeholder="Member Name *" value={memName} onChange={e => setMemName(e.target.value)} />
                </FieldRow>
                <FieldRow icon="phone">
                  <input className={inputCls} placeholder="Phone Number" type="tel" value={memPhone} onChange={e => setMemPhone(e.target.value)} />
                </FieldRow>
              </div>

              <button onClick={saveMember} disabled={saving}
                className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl text-base transition-colors disabled:opacity-60">
                {saving ? 'Saving…' : 'Add Member & Continue'}
              </button>
              <button onClick={() => setStep(2)}
                className="w-full py-3 border border-outline-variant text-on-surface-variant font-semibold rounded-2xl text-sm hover:bg-surface-container transition-colors">
                Skip for Now
              </button>
            </>
          )}

          {/* ── Step 3: Done ── */}
          {step === 2 && (
            <div className="flex flex-col items-center text-center pt-10 space-y-4">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-5xl">🎉</div>
              <h2 className="text-2xl font-bold text-on-surface">You're all set!</h2>
              <p className="text-on-surface-variant text-base max-w-xs">
                Your gym is ready to manage. Let's get started!
              </p>
              <button onClick={() => navigate('/')}
                className="mt-6 w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl text-base transition-colors">
                Go to Dashboard
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
