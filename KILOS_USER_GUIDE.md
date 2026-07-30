# Kilos Gym ERP — Complete User Guide

> A detailed module-by-module guide for gym owners and staff using the Kilos platform.

---

## Table of Contents

1. [Getting Started & Login](#1-getting-started--login)
2. [Dashboard](#2-dashboard)
3. [Members](#3-members)
4. [Renewals](#4-renewals)
5. [Payments](#5-payments)
6. [Leads / Enquiries](#6-leads--enquiries)
7. [Membership Plans](#7-membership-plans)
8. [Attendance & Check-in](#8-attendance--check-in)
9. [Personal Training (PT)](#9-personal-training-pt)
10. [Workout Plans](#10-workout-plans)
11. [Diet Plans](#11-diet-plans)
12. [Staff & Trainers](#12-staff--trainers)
13. [Reports](#13-reports)
14. [Settings](#14-settings)

---

## 1. Getting Started & Login

### Roles

| Role | Access |
|------|--------|
| **Super Admin** | Full platform management across all gyms |
| **Admin** | Full access to their gym's data |
| **Staff** | Check-in page only |

### Logging In
1. Go to the Kilos web app URL.
2. Enter your **email** and **password**.
3. You'll be redirected to the correct dashboard based on your role.

### First-Time Setup (Admin)
After your gym is registered by the Super Admin:
1. Go to **Settings → Gym Information** and fill in your gym name, address, location, and contact number.
2. Go to **Plans** and create at least one membership plan.
3. Add your first member via **Members → Add Member**.

---

## 2. Dashboard

The Dashboard gives a quick snapshot of your gym's current state.

### What You See
- **Active Members** — total members currently active
- **Revenue This Month** — sum of all payments recorded this month
- **Expiring Soon** — members whose membership expires within the next 7 days
- **Today's Attendance** — number of check-ins recorded today

### Quick Actions
Four shortcut buttons are available at the top:
- **New Member** — opens the Add Member form
- **Record Payment** — opens the Record Payment page
- **Check-in** — opens the QR-scan check-in page
- **Renewals** — opens the Renewals page, with a badge showing how many members expire within 7 days

---

## 3. Members

### 3.1 Member List

Access via **Members** in the sidebar.

**Filter Tabs:**
- **All** — every member
- **Active** — members with a valid, non-expired, non-frozen membership
- **Expiring** — members expiring within 7 days
- **Expired** — past-expiry members
- **Frozen** — members whose membership is paused

**Search:** Type a name or phone number in the search box.

**Each row shows:** Name, Phone, Plan, Expiry Date, Status badge, and an action to view the profile.

---

### 3.2 Add Member

Click **+ Add Member** (top-right of the Member List).

**Personal Details:**
| Field | Required | Notes |
|-------|----------|-------|
| Full Name | Yes | |
| Phone | Yes | 10-digit |
| Email | No | |
| Date of Birth | No | |
| Gender | No | Male / Female / Other |
| Address | No | |
| Emergency Contact | No | Name + phone of emergency contact |
| Fitness Goal | No | Weight Loss, Muscle Gain, General Fitness, etc. |
| Health Notes | No | Allergies, injuries, medical conditions |

**Plan & Fees:**
| Field | Notes |
|-------|-------|
| Plan | Pick from active plans in your gym |
| Plan Active From | Start date of the membership |
| Joining Fee | One-time joining amount |
| Total Fees | Full plan price |
| Paid Amount | Amount collected today |
| Balance | Auto-calculated or manually entered |
| Payment Mode | Cash / UPI / Card / Bank Transfer / Cheque |

> **Tip:** When converting a Lead to a member, the form is pre-filled with the lead's name, phone, email, and interested plan. Just verify and save.

---

### 3.3 Member Profile

Click **View** on any member to open their full profile.

**Header actions:**
- **Collect Payment** — record a new payment for this member
- **Download Receipt** — generates a printable receipt (includes GST breakdown if applicable)
- **Edit** — modify member details, plan info, and fees
- **Freeze / Unfreeze** — pause the membership with a resume date
- **Delete** — permanently remove the member

**Status Badge:**
- Green "Active" — valid membership
- Red "Expired" — past expiry date
- Blue "Frozen ❄" — membership paused, shows resume date

**Health Info Card:**  
Shown when Emergency Contact or Health Notes are present.

**Progress / Weight Log:**
- Log weight entries: select date → enter weight (kg) → optional note → click **Log**
- Entries appear in reverse chronological order
- Delete any entry with the trash icon

**Payment History:**
- All past payments with plan name, dates, amount, and mode
- Click ✏️ to edit a payment (mode, amount, notes, date)
- Click 🗑 to delete a payment record

**Attendance:**
- **Calendar view** — days attended highlighted in purple
- **List view** — every check-in with time and optional duration
- Navigate months with arrows
- Delete attendance records from the list view

---

### 3.4 Freeze / Unfreeze Membership

**To Freeze:**
1. Open the member profile.
2. Click **Freeze** (blue snowflake button).
3. Pick a **Resume Date** (must be tomorrow or later).
4. Click **Freeze Membership**.

The member's status changes to **Frozen**. They won't appear in the Expiring or Active filters during the freeze period.

**To Unfreeze:**
1. Open the member profile.
2. Click **Unfreeze** (green button).
3. Status instantly returns to **Active**.

---

## 4. Renewals

Access via **Renewals** in the sidebar.

### Purpose
Manage upcoming renewals and frozen memberships from a single place.

### Stats Row
- **Expired** — count of expired members
- **Expiring Soon** — count expiring within your selected range
- **Frozen** — count of frozen members

### Range Filter
Select 7, 14, or 30 days to adjust the "expiring soon" window.

### Due for Renewal Section
Shows members expiring within the selected range. For each member:
- **Freeze** — opens a modal to set a resume date
- **Renew** — opens the Record Payment page pre-filled with this member

### Frozen Members Section
Lists all currently frozen members with their resume date. Click **Unfreeze** to resume immediately.

---

## 5. Payments

Access via **Payments** in the sidebar.

### Tabs

**All Payments:**
- Revenue summary at the top: Total Revenue, Total Payments count, This Month count
- **Payment Mode Breakdown** — shows how much was collected via Cash, UPI, Card, etc.
- Searchable table with Member, Plan, Active From, Expiry, Amount, Mode, Date
- Click ✏️ to edit any payment record (mode, amount, notes)

**Dues & Expired:**
- Lists all members with expired or missing memberships
- Shows days overdue for each member
- **SMS** — send a reminder message directly (if SMS integration is configured)
- **Renew** — open payment recording pre-filled with this member
- **View** — open the member profile

### Record Payment

Click **Record Payment** (top-right) or from a member profile.

| Field | Notes |
|-------|-------|
| Member | Search and select from your members |
| Plan | Choose from active plans — auto-fills price |
| Plan Active From | Start date |
| Expiry Date | Auto-calculated based on plan duration, or manually set |
| Payment Mode | Cash / UPI / Card / Bank Transfer / Cheque |
| Amount Paid | |
| Balance Due | Auto-calculated |
| Notes | Optional (e.g. "Paid via PhonePe") |

After saving, the member's plan, expiry date, and payment record are all updated.

---

## 6. Leads / Enquiries

Access via **Leads** in the sidebar.

### Lead List

View all enquiries with status, source, follow-up date, and assigned staff.

**Status Badges:**
| Status | Color | Meaning |
|--------|-------|---------|
| New | Blue | Fresh enquiry |
| Contacted | Purple | First contact made |
| Follow-up | Orange | Needs follow-up |
| Interested | Teal | Actively interested |
| Won | Green | Converted to member |
| Lost | Red | Did not convert |

**Actions:**
- **Edit** — update lead details
- **Convert** — (shown for "Won" and "Interested" leads) opens Add Member with the lead's data pre-filled
- **Delete** — remove the lead

---

### 6.1 Add / Edit Lead

| Field | Notes |
|-------|-------|
| Name | Required |
| Phone | Required |
| Email | Optional |
| Source | Walk-in / Phone / WhatsApp / Website / Referral |
| Status | New → Contacted → Follow-up → Interested → Won / Lost |
| Interested Plan | Which plan they're asking about |
| Budget | Expected spend in ₹ |
| Next Follow-up | Date for the next contact |
| Assigned To | Staff member handling this lead |
| Reason for Loss | Only shown when Status = Lost (dropdown: Too expensive, Joined competitor, etc.) |
| Notes | Free text |

---

### 6.2 Converting a Lead to Member

1. In the Lead List, find a **Won** or **Interested** lead.
2. Click **Convert** in the Actions column.
3. The Add Member page opens with Name, Phone, Email, and Plan pre-filled.
4. Verify the details, fill in the payment information, and save.
5. The member is created and appears in your member list.

---

## 7. Membership Plans

Access via **Plans** in the sidebar.

### Plan Types
| Type | Badge Color | Use For |
|------|-------------|---------|
| Gym Membership | Violet | Monthly/quarterly/annual memberships |
| Personal Training | Blue | PT packages |
| Group Class | Green | Yoga, Zumba, etc. |
| Day Pass | Orange | Single-day access |
| Add-on | Amber | Locker, towel service, etc. |

### Filter Tabs
Filter plans by type (All / Gym / Personal Training / Group Class / Day Pass / Add-ons).

### Plan Card Shows
- Plan name and type badge
- Active/Inactive status
- Price + joining fee
- GST % (if set)
- Duration in months or session count
- Description + first 3 features

### Active Toggle
Toggle active/inactive directly from the card. Inactive plans won't appear in the member enrollment dropdown.

---

### 7.1 Create / Edit Plan

| Field | Required | Notes |
|-------|----------|-------|
| Plan Name | Yes | e.g. "Monthly Standard", "Annual Premium" |
| Type | Yes | Gym / Personal Training / Group Class / Day Pass / Add-on |
| Duration (Months) | No | Not shown for Day Pass; auto-hidden for PT with sessions |
| Sessions Included | No | Shown for Personal Training and Group Class |
| Price (₹) | Yes | |
| Joining Fee (₹) | No | One-time fee on top of plan price |
| GST % | No | If set, receipt shows GST breakdown |
| Description | No | Shown on the plan card |
| Features / Benefits | No | Add line items (press Enter or click Add) |
| Active | Toggle | Inactive = won't show during enrollment |

---

## 8. Attendance & Check-in

### Staff Check-in Page

The Check-in page is the only page Staff (non-admin) users can access.

**How to check in a member:**
1. Click **Scan QR** — the camera opens and scans the member's QR code.
2. Or type/search the member name in the search box and click **Check In**.
3. The system logs the time and the member's attendance record is updated.

### Viewing Attendance (Admin)
- Per-member attendance is visible in the **Member Profile** under the Attendance section.
- Monthly attendance counts appear in the Attendance calendar view.

---

## 9. Personal Training (PT)

Access via **Personal Training** in the sidebar.

### Tabs

**Packages:**  
Manage PT packages available in your gym.

| Field | Notes |
|-------|-------|
| Package Name | e.g. "Premium Strength Training" |
| Trainer | Dropdown from staff (Trainer / Manager roles) |
| Sessions Included | Total sessions in the package |
| Duration (Months) | Validity period |
| Price (₹) | |
| Description | Optional |

Each package card shows:
- Sessions included
- **Sessions remaining** (green if > 0, red if exhausted) — calculated from completed sessions linked to this package
- Duration and price

**Sessions:**  
Log individual training sessions.

| Field | Notes |
|-------|-------|
| Date | Session date |
| Time | Session time |
| Member | Dropdown from all members |
| Trainer | Dropdown from staff (Trainer / Manager roles) |
| Package | Link to a PT package (optional) |
| Status | Scheduled / Completed / Cancelled |
| Notes | Optional session notes |

When a session is marked **Completed** and linked to a package, it decrements the "sessions remaining" counter on that package card.

### Stats (Header)
- Total packages
- Completed sessions this month
- Scheduled (upcoming) sessions
- Total sessions

---

## 10. Workout Plans

Access via **Workouts** in the sidebar.

### Workout List
View all saved workout plans. Filter by Level (Beginner / Intermediate / Advanced) and Goal.

### Create / Edit Workout Plan

| Field | Notes |
|-------|-------|
| Plan Name | e.g. "Full Body Burn" |
| Level | Beginner / Intermediate / Advanced |
| Goal | Fat Loss / Muscle Gain / Endurance / Flexibility / General Fitness |
| Duration (minutes) | Per session |
| Days per Week | 1–7 |
| Assigned Member | Optional — dropdown from members list; leave blank to save as a reusable template |
| Description | Optional |
| Exercises | Add one by one: Name, Sets, Reps, Rest (seconds), Notes |

Plans assigned to a member appear on their profile (in a future update). Template plans can be duplicated and assigned to different members.

---

## 11. Diet Plans

Access via **Diet** in the sidebar.

### Diet Plan List
View all diet plans with goal, calorie target, and assigned member (if any).

### Create / Edit Diet Plan

**Header Info:**
| Field | Notes |
|-------|-------|
| Plan Name | e.g. "2200 kcal Muscle Gain Plan" |
| Goal | Weight Loss / Muscle Gain / Maintenance / Medical |
| Calories per Day | Target daily calories |
| Protein (g) | |
| Carbs (g) | |
| Fat (g) | |
| Assigned Member | Dropdown from members; blank = reusable template |
| Description | Optional |

A **macro calculator** auto-checks whether your protein + carbs + fat macros match the calorie target (within 5%).

**Meal Schedule:**
Add individual meals:
| Field | Notes |
|-------|-------|
| Meal Name | Breakfast / Lunch / Dinner / Snack / Pre-Workout / Post-Workout / Custom |
| Description | What to eat |
| Calories | Estimated calories for this meal |

---

## 12. Staff & Trainers

Access via **Staff** in the sidebar.

### Staff List
Filter by role: All / Trainer / Staff / Manager / Receptionist.

Search by name or phone.

Each card/row shows: Name, Email, Role badge, Phone, Joining Date, Salary.

### Add / Edit Staff Member

**Basic Info:**
| Field | Notes |
|-------|-------|
| Full Name | Required |
| Role | Trainer / Staff / Manager / Receptionist |
| Phone | Required |
| Email | Optional |
| Joining Date | Default: today |
| Salary (₹) | Fixed monthly salary |
| Address | Optional |
| Certifications | e.g. "ACE CPT, NASM, Zumba Instructor" |
| Commission Type | Fixed Salary Only / Commission Only / Salary + Commission |
| Commission % | Shown when commission type includes commission |

**Login Access (Add only):**  
Toggle to create a Kilos account for this staff member.
- They'll get Staff role access (Check-in page only)
- Enter their login email and a password (min. 6 characters)

### Staff Profile
Click **View** on any staff member to see their full profile including attendance, session history (for trainers), and QR card.

---

## 13. Reports

Access via **Reports** in the sidebar.

### Tabs

**Overview:**
Shows month-by-month business data for the selected month.

- **Stats Row:** New Admissions, Renewals, Revenue Collected, Total Payments
- **Comparison:** vs. previous month with % change indicators
- **Charts:** Revenue bar chart, Admissions vs Renewals bar chart
- **New Members Table:** All members who joined this month
- **Payments Table:** All payment transactions this month with totals

**Leads:**
Shows lead funnel data for the selected month.

- **Stats:** Total leads, Converted (Won), Lost, Conversion rate %
- **Leads by Status** — progress bar breakdown (New, Contacted, etc.)
- **Leads by Source** — progress bar breakdown (Walk-in, Phone, etc.)
- **Leads Table** — all leads this month with name, phone, source, status, plan, budget

### Month Selector
Use the month picker (top-right) to view any past month.

### Export Options
- **Export PDF** — generates a full-page PDF snapshot of the Overview tab
- **Export Excel** — generates a .xlsx file with Summary, New Members, and Payments sheets

---

## 14. Settings

Access via **Settings** in the sidebar.

### Appearance
Toggle between **Light** and **Dark** mode. The preference is saved per device.

### Gym Information
Update your gym's basic details:

| Field | Notes |
|-------|-------|
| Gym Name | Appears on receipts and QR codes |
| Location / Area | Shown on receipts |
| Contact Number | Shown on receipts |
| Website | Optional |

Click **Save Changes** to update.

> Changes to Gym Name and Location take effect immediately on all new receipts.

---

## Tips & Common Workflows

### Monthly Renewal Workflow
1. Go to **Renewals** → set range to 30 days.
2. Call or WhatsApp members due for renewal.
3. When they pay, click **Renew** → record the payment.
4. If they need time, click **Freeze** → set a resume date.

### Lead to Member Workflow
1. Go to **Leads** → add lead when someone enquires.
2. Update status to **Interested** after first contact.
3. Update to **Won** when they commit.
4. Click **Convert** → verify details → save as member.

### Generating a Receipt
1. Go to **Members** → open the member's profile.
2. Click **Download Receipt** in the header.
3. A print preview opens → Print or Save as PDF.

### Adding a PT Package and Tracking Sessions
1. Go to **Personal Training → Packages** → create a package.
2. Assign a trainer from your staff roster.
3. When sessions happen, go to **Sessions** → Log Session.
4. Select the member, trainer, and link to the package.
5. Mark status as **Completed** to decrement the sessions remaining counter.

---

*Kilos Gym ERP — Built for modern gym management.*
