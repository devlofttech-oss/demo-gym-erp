/**
 * Member Import Script
 * Usage: node import-members.mjs
 *
 * Set CATEGORY and RAW data below before running.
 * Columns (full):    [SL, NAME, PHONE, ADMISSION_DATE, DUE_DATE, MEMBERSHIP, TOTAL_FEES, FEES_PAID, BALANCE_FEES, PAYMENT_MODE]
 * Columns (no fees): [SL, NAME, PHONE, ADMISSION_DATE, DUE_DATE, MEMBERSHIP]
 * If fee columns are omitted they default to 0.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';


// ─── CHANGE THIS FOR EACH IMPORT ────────────────────────────────────────────
const CATEGORY = 'Kids Dance';

// Kids Dance columns: [SL, NAME, PHONE, ADMISSION_DATE, DUE_DATE, PLAN, FEES_PAID, BALANCE_FEES, PAYMENT_MODE]
// totalFees is auto-computed as paidFees + balanceFees
const RAW = [
  [1,'Himanth','7022670531','1/7/2026','7/7/2026','6 months','4000/-','nil','upi'],
  [2,'Asuthosh','8971917912','1/7/2026','4/7/2026','3 months','2500/-','nil','upi'],
  [3,'Krishna','8867348834','','','','','',''],
  [4,'Keerthi','8867348834','','','','','',''],
  [5,'Advik.S','8945991470','','','','','',''],
  [6,'Aishani Gowda','7204173161','1/25/2026','','3 months','','',''],
  [7,'Tharini Srinivas','9964514517','1/6/2026','2/6/2026','monthly','800/-','nil','upi'],
  [8,'Sathvik Gowda','8618943274','2/6/2026','','3 months','','',''],
  [9,'Diksha .Y','9141321929','1/15/2026','','6 months','','',''],
  [10,'Harshavardhan .NH','9481323819','1/8/2026','2/8/2026','monthly','1000/-','nil','Cash'],
  [11,'Vikshitha','9902794613','2/28/2026','','3 months','','',''],
  [12,'Banvitha .S','7829848377','1/6/2026','2/6/2026','monthly','1000/-','nil','upi'],
  [13,'vidvik','9900590468','','','','','',''],
  [14,'Samarth','9900022278','1/15/2026','','3 months','','',''],
  [15,'Brunda .S','9945871981','1/27/2026','','3 months','','',''],
  [16,'Shreyank','9743556696','2/3/2026','','3 months','','1200/-',''],
  [17,'Lasya.K.V','9945852255','1/5/2026','2/5/2026','monthly','1000/-','',''],
  [18,'Punarvi .K.V','9945852255','1/5/2026','2/5/2026','monthly','1000/-','',''],
  [19,'Samskruthi.P','9632476599','1/11/2026','','monthly','','',''],
  [20,'Thanuja .M','9900262614','2/1/2026','','monthly','800','',''],
  [21,'Nithvik.S.Mourya','7204269597','4/5/2026','7/5/2026','3 months','2500/-','',''],
  [22,'Karunya .S','7676245996','1/5/2026','4/5/2026','3 months','2500/-','',''],
  [23,'Pranav gowda .S','7676245996','1/5/2026','4/5/2026','3 months','2500/-','',''],
  [24,'Manasvi .T.S','9743999577','1/5/2026','4/5/2026','3 months','2500/-','',''],
  [25,'Monika .M.S','','1/6/2026','4/6/2026','3 months','2500/-','',''],
  [26,'Namrudh','','1/6/2026','4/6/2026','3 months','2500/-','',''],
  [27,'Divya.N','','1/6/2026','4/6/2026','3 months','2000/-','',''],
  [28,'Aryan suriya','9742836663','1/21/2026','7/21/2026','6 months','4000/-','nil','CASH'],
  [29,'Ashvika arya','9742836663','1/21/2026','7/21/2026','6 months','4000/-','nil','CASH'],
  [30,'GUHAN','9019311488','3/23/2026','6/23/2026','3 months','2500/-','nil','CASH'],
  [31,'NAKSHATHRA GOWDA','9035030168','4/8/2026','5/8/2026','monthly','1000/-','nil','CASH'],
];
// ────────────────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function parseDate(str) {
  if (!str || str.trim() === '' || str.trim() === '`') return '';
  str = str.trim();
  // M/D/YYYY
  let m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
  // DD-MM-YYYY
  m = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  return '';
}

function parseFee(str) {
  if (!str || str.trim() === '') return 0;
  const s = str.trim().toLowerCase();
  if (['nil','nill','nil/-','nill/-'].includes(s)) return 0;
  const n = parseInt(s.replace(/\/-.*$/,'').replace(/[^0-9]/g,''));
  return isNaN(n) ? 0 : n;
}

function parseMode(str) {
  if (!str || str.trim() === '') return 'Cash';
  const s = str.trim().toLowerCase();
  if (s === 'upi') return 'UPI';
  if (s.includes('upi') && s.includes('cash')) return 'Cash/UPI';
  if (s.includes('upi')) return 'UPI';
  if (s.includes('cash')) return 'Cash';
  return 'Cash';
}

function computeStatus(expiryDate) {
  if (!expiryDate) return 'Active';
  return new Date(expiryDate) < new Date() ? 'Expired' : 'Active';
}

async function importAll() {
  if (RAW.length === 0) {
    console.log('No data in RAW array. Add rows and run again.');
    process.exit(0);
  }

  const members = RAW.map(([sl, name, phone, admDate, dueDate, membership, col6='0', col7='0', col8='Cash', col9]) => {
    const joinDate = parseDate(admDate);
    const expiryDate = parseDate(dueDate);
    // Support both 10-col (totalFees, paidFees, balance, mode) and 9-col (paidFees, balance, mode) formats
    let totalFees, paidFees, balanceFees, paymentMode;
    if (col9 !== undefined) {
      // 10-col: col6=totalFees, col7=paidFees, col8=balance, col9=mode
      totalFees   = parseFee(col6);
      paidFees    = parseFee(col7);
      balanceFees = parseFee(col8);
      paymentMode = parseMode(col9);
    } else {
      // 9-col: col6=paidFees, col7=balance, col8=mode
      paidFees    = parseFee(col6);
      balanceFees = parseFee(col7);
      paymentMode = parseMode(col8);
      totalFees   = paidFees + balanceFees;
    }
    return {
      sl,
      name: name.trim(),
      phone: String(phone).trim(),
      email: '',
      joinDate: joinDate || expiryDate,
      planActiveFrom: joinDate || expiryDate,
      expiryDate,
      planName: membership.trim() ? `${CATEGORY} - ${membership.trim()}` : '',
      totalFees,
      paidFees,
      balanceFees,
      paymentMode,
      status: computeStatus(expiryDate),
    };
  });

  console.log(`\nImporting ${members.length} members into category: ${CATEGORY}...\n`);
  let ok = 0, fail = 0;

  for (const m of members) {
    try {
      const memberRef = await addDoc(collection(db, 'members'), {
        name: m.name,
        phone: m.phone,
        email: m.email,
        joinDate: m.joinDate,
        planName: m.planName,
        planActiveFrom: m.planActiveFrom,
        expiryDate: m.expiryDate,
        status: m.status,
        totalFees: m.totalFees,
        paidFees: m.paidFees,
        balanceFees: m.balanceFees,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'payments'), {
        memberId: memberRef.id,
        memberName: m.name,
        memberPhone: m.phone,
        planName: m.planName,
        planActiveFrom: m.planActiveFrom,
        expiryDate: m.expiryDate,
        totalFees: m.totalFees,
        paidAmount: m.paidFees,
        amount: m.paidFees,
        balanceFees: m.balanceFees,
        paymentMode: m.paymentMode,
        date: new Date().toISOString(),
        status: 'Paid',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log(`[${String(ok+1).padStart(3)}] ✓ ${m.name} (${m.status})`);
      ok++;
    } catch (err) {
      console.error(`[SL${m.sl}] ✗ ${m.name}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\nDone. ${ok} imported, ${fail} failed.\n`);
  process.exit(0);
}

importAll();
