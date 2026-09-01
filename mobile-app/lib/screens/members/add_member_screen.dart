import 'dart:io';

import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

const _fitnessGoals = ['Weight Loss', 'Muscle Gain', 'General Fitness', 'Stamina', 'Flexibility', 'Rehabilitation'];
const _payModes = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque'];

class AddMemberScreen extends StatefulWidget {
  final String? prefillName;
  final String? prefillPhone;
  const AddMemberScreen({super.key, this.prefillName, this.prefillPhone});
  @override
  State<AddMemberScreen> createState() => _AddMemberScreenState();
}

class _AddMemberScreenState extends State<AddMemberScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _emergency = TextEditingController();
  final _health = TextEditingController();
  final _joiningFees = TextEditingController();
  final _discount = TextEditingController();
  final _nextDays = TextEditingController();
  final _paidNow = TextEditingController();

  List<Map<String, dynamic>> _plans = [];
  String? _planId;
  String _planName = '';
  int _durationMonths = 1;
  num _totalFees = 0;
  String _paymentMode = 'Cash';
  String? _fitnessGoal;
  String _dob = '';
  late String _joinDate;
  late String _planActiveFrom;
  late String _expiryDate;
  bool _saving = false;
  File? _photoFile;

  @override
  void initState() {
    super.initState();
    _joinDate = todayStr();
    _planActiveFrom = todayStr();
    _expiryDate = addDays(todayStr(), 30);
    if (widget.prefillName != null) _name.text = widget.prefillName!;
    if (widget.prefillPhone != null) _phone.text = widget.prefillPhone!;
    _loadPlans();
  }

  @override
  void dispose() {
    for (final c in [_name, _phone, _email, _emergency, _health, _joiningFees, _discount, _nextDays, _paidNow]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadPlans() async {
    final gymId = context.read<AuthProvider>().gymId;
    final data = await TenantDb.getCollection(gymId, 'plans');
    final active = data.where((p) => p['isActive'] != false).toList();
    setState(() {
      _plans = active;
      if (active.isNotEmpty) _applyPlan(active.first);
    });
  }

  void _applyPlan(Map<String, dynamic> p) {
    final months = asNum(p['durationMonths']).toInt();
    _planId = p['id'] as String?;
    _planName = (p['name'] as String?) ?? '';
    _durationMonths = months > 0 ? months : 1;
    _totalFees = asNum(p['price']);
    _joiningFees.clear();
    _discount.clear();
    _paidNow.clear();
    _recalcExpiry();
  }

  void _recalcExpiry() {
    setState(() {
      _expiryDate = _durationMonths > 0 ? addMonthsEnd(_planActiveFrom, _durationMonths) : addDays(_planActiveFrom, 30);
    });
  }

  num get _discountPct => (num.tryParse(_discount.text) ?? 0).clamp(0, 100);
  num get _discountedTotal => (_totalFees * (1 - _discountPct / 100)).round();
  num get _joiningFeesAmt => num.tryParse(_joiningFees.text) ?? 0;
  num get _finalTotal => _discountedTotal + _joiningFeesAmt;
  num get _paidNum => num.tryParse(_paidNow.text) ?? 0;
  num get _balance => (_finalTotal - _paidNum).clamp(0, double.infinity);

  Future<void> _pickDate(String which) async {
    DateTime? init;
    DateTime firstDate = DateTime(2020);
    DateTime lastDate = DateTime(2100);
    if (which == 'dob') {
      init = _dob.isEmpty ? DateTime.now().subtract(const Duration(days: 365 * 25)) : DateTime.tryParse(_dob);
      firstDate = DateTime(1940);
      lastDate = DateTime.now();
    } else {
      init = DateTime.tryParse(which == 'join' ? _joinDate : which == 'active' ? _planActiveFrom : _expiryDate) ?? DateTime.now();
    }
    final picked = await showDatePicker(context: context, initialDate: init ?? DateTime.now(), firstDate: firstDate, lastDate: lastDate);
    if (picked == null) return;
    final iso = picked.toIso8601String().split('T').first;
    setState(() {
      if (which == 'join') _joinDate = iso;
      else if (which == 'active') { _planActiveFrom = iso; _recalcExpiry(); }
      else if (which == 'dob') _dob = iso;
      else _expiryDate = iso;
    });
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final picked = await showModalBottomSheet<XFile?>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Take photo'),
              onTap: () async {
                final f = await picker.pickImage(source: ImageSource.camera, imageQuality: 70, maxWidth: 600);
                if (ctx.mounted) Navigator.pop(ctx, f);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Choose from gallery'),
              onTap: () async {
                final f = await picker.pickImage(source: ImageSource.gallery, imageQuality: 70, maxWidth: 600);
                if (ctx.mounted) Navigator.pop(ctx, f);
              },
            ),
            if (_photoFile != null)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.red),
                title: const Text('Remove photo', style: TextStyle(color: Colors.red)),
                onTap: () => Navigator.pop(ctx),
              ),
          ],
        ),
      ),
    );
    if (picked != null) {
      setState(() => _photoFile = File(picked.path));
    }
  }

  Future<String?> _uploadPhoto(String gymId, String memberId) async {
    if (_photoFile == null) return null;
    try {
      final ref = FirebaseStorage.instance.ref('gyms/$gymId/members/$memberId/photo.jpg');
      await ref.putFile(_photoFile!);
      return await ref.getDownloadURL();
    } catch (_) {
      return null;
    }
  }

  Future<void> _submit() async {
    if (_phone.text.trim().isEmpty) {
      _toast('Phone number is required');
      return;
    }
    final gymId = context.read<AuthProvider>().gymId!;
    final discount = _discountPct;
    final joiningFees = _joiningFeesAmt;
    final totalFees = (_totalFees * (1 - discount / 100)).round() + joiningFees;
    final paid = _paidNum;
    final balance = (totalFees - paid).clamp(0, double.infinity);
    final nextPaymentDate = _nextDays.text.isNotEmpty ? addDays(_joinDate, int.tryParse(_nextDays.text) ?? 0) : null;

    setState(() => _saving = true);
    try {
      final member = await TenantDb.createDocument(gymId, 'members', {
        'name': _name.text.trim(),
        'phone': _phone.text.trim(),
        'email': _email.text.trim(),
        'joinDate': _joinDate,
        'planName': _planName,
        'planActiveFrom': _planActiveFrom,
        'expiryDate': _expiryDate,
        'status': 'Active',
        'totalFees': totalFees,
        'paidFees': paid,
        'balanceFees': balance,
        if (joiningFees > 0) 'joiningFees': joiningFees,
        if (discount > 0) 'discountPercent': discount,
        if (nextPaymentDate != null) 'nextPaymentDate': nextPaymentDate,
        if (_emergency.text.isNotEmpty) 'emergencyContact': _emergency.text.trim(),
        if (_fitnessGoal != null) 'fitnessGoal': _fitnessGoal,
        if (_health.text.isNotEmpty) 'healthNotes': _health.text.trim(),
        if (_dob.isNotEmpty) 'dateOfBirth': _dob,
      });
      if (_photoFile != null) {
        final memberId = member['id'] as String? ?? '';
        final url = await _uploadPhoto(gymId, memberId);
        if (url != null && memberId.isNotEmpty) {
          await TenantDb.updateDocument(gymId, 'members', memberId, {'photoUrl': url});
        }
      }
      await TenantDb.createDocument(gymId, 'payments', {
        'memberId': member['id'],
        'memberName': _name.text.trim(),
        'memberPhone': _phone.text.trim(),
        'planName': _planName,
        'planActiveFrom': _planActiveFrom,
        'expiryDate': _expiryDate,
        'totalFees': totalFees,
        'paidAmount': paid,
        'balanceFees': balance,
        'amount': paid,
        'paymentMode': _paymentMode,
        'date': DateTime.now().toIso8601String(),
        'status': 'Paid',
      });
      if (mounted) {
        _toast('Member added & payment recorded!');
        Navigator.pop(context);
      }
    } catch (e) {
      _toast('Failed to add member');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        leading: IconButton(icon: Sym(MSym.arrowBack, size: 20, color: c.onSurface), onPressed: () => Navigator.pop(context)),
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text('Add New Member', style: KText.h3.copyWith(color: c.onSurface)),
          Text('Register a member and record their first payment', style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
        ]),
      ),
      body: ListView(
        padding: const EdgeInsets.all(KSpace.gutter),
        children: [
          KCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _sectionTitle(MSym.person, 'Personal Details'),
                const SizedBox(height: 16),
                _photoPicker(),
                const SizedBox(height: 16),
                _field('Full Name *', _name, hint: 'e.g. Rahul Sharma'),
                _field('Phone Number *', _phone, hint: 'e.g. 9876543210', keyboard: TextInputType.phone),
                _field('Email (optional)', _email, hint: 'e.g. rahul@email.com', keyboard: TextInputType.emailAddress),
                _dateField('Date of Birth', _dob.isEmpty ? '' : _dob, () => _pickDate('dob'), allowEmpty: true),
                _dateField('Date of Joining', _joinDate, () => _pickDate('join')),
                _field('Emergency Contact', _emergency, hint: 'Name & phone'),
                _dropdown<String?>('Fitness Goal', _fitnessGoal, [
                  const DropdownMenuItem(value: null, child: Text('Select goal...')),
                  ..._fitnessGoals.map((g) => DropdownMenuItem(value: g, child: Text(g))),
                ], (v) => setState(() => _fitnessGoal = v)),
                _field('Health Notes (optional)', _health, hint: 'Conditions, injuries...'),
                const Divider(height: 32),
                _sectionTitle(MSym.cardMembership, 'Plan & Payment'),
                const SizedBox(height: 16),
                _planDropdown(),
                _field('Joining Fees (₹)', _joiningFees, hint: '0', keyboard: TextInputType.number, onChanged: (_) => setState(() {}), numbersOnly: true),
                Row(children: [
                  Expanded(child: _field('Discount (%)', _discount, hint: '0', keyboard: TextInputType.number, onChanged: (_) => setState(() {}), numbersOnly: true)),
                  const SizedBox(width: 12),
                  Expanded(child: _field('Next Payment (days)', _nextDays, hint: 'e.g. 30', keyboard: TextInputType.number, numbersOnly: true)),
                ]),
                _feesRow(),
                Row(children: [
                  Expanded(child: _dateField('Active From', _planActiveFrom, () => _pickDate('active'))),
                  const SizedBox(width: 12),
                  Expanded(child: _dateField('Expiry Date', _expiryDate, () => _pickDate('expiry'))),
                ]),
                _dropdown<String>('Payment Mode', _paymentMode,
                    _payModes.map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(),
                    (v) => setState(() => _paymentMode = v!)),
                const SizedBox(height: 16),
                _summary(),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 50,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: c.primary, foregroundColor: c.onPrimary),
              onPressed: _saving ? null : _submit,
              icon: _saving ? const KSpinner(size: 18, color: Colors.white) : const Sym(MSym.personAdd, size: 18),
              label: Text(_saving ? 'Saving...' : 'Add Member & Record Payment'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _photoPicker() {
    final c = context.c;
    return GestureDetector(
      onTap: _pickPhoto,
      child: Center(
        child: Stack(
          children: [
            CircleAvatar(
              radius: 44,
              backgroundColor: c.primaryContainer,
              backgroundImage: _photoFile != null ? FileImage(_photoFile!) : null,
              child: _photoFile == null
                  ? Sym(MSym.addAPhoto, size: 28, color: c.primary)
                  : null,
            ),
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                    color: c.primary,
                    shape: BoxShape.circle,
                    border: Border.all(color: c.surface, width: 2)),
                child: const Sym(MSym.edit, size: 13, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(IconData icon, String t) {
    final c = context.c;
    return Row(children: [
      Sym(icon, size: 16, color: c.onSurfaceVariant),
      const SizedBox(width: 8),
      Text(t.toUpperCase(), style: KText.labelCaps.copyWith(color: c.onSurfaceVariant, letterSpacing: 1)),
    ]);
  }

  Widget _field(String label, TextEditingController ctrl, {String? hint, TextInputType? keyboard, ValueChanged<String>? onChanged, bool numbersOnly = false}) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(color: c.onSurface, fontSize: 14, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          keyboardType: keyboard,
          onChanged: onChanged,
          inputFormatters: numbersOnly ? [FilteringTextInputFormatter.digitsOnly] : null,
          style: TextStyle(color: c.onSurface),
          decoration: _inputDec(hint),
        ),
      ]),
    );
  }

  Widget _dateField(String label, String value, VoidCallback onTap, {bool allowEmpty = false}) {
    final c = context.c;
    final isEmpty = value.isEmpty;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(color: c.onSurface, fontSize: 14, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        InkWell(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(color: c.surfaceContainer, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.outlineVariant.withValues(alpha: 0.3))),
            child: Row(children: [
              Text(
                isEmpty && allowEmpty ? 'Optional' : value,
                style: TextStyle(color: isEmpty && allowEmpty ? c.onSurfaceVariant.withValues(alpha: 0.5) : c.onSurface),
              ),
              const Spacer(),
              Sym(MSym.calendarMonth, size: 18, color: c.onSurfaceVariant),
            ]),
          ),
        ),
      ]),
    );
  }

  Widget _dropdown<T>(String label, T value, List<DropdownMenuItem<T>> items, ValueChanged<T?> onChanged) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(color: c.onSurface, fontSize: 14, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(color: c.surfaceContainer, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.outlineVariant.withValues(alpha: 0.3))),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<T>(
              value: value,
              isExpanded: true,
              dropdownColor: c.surfaceContainerLowest,
              style: TextStyle(color: c.onSurface, fontFamily: 'PlusJakartaSans', fontSize: 14),
              items: items,
              onChanged: onChanged,
            ),
          ),
        ),
      ]),
    );
  }

  Widget _planDropdown() {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Membership Plan', style: TextStyle(color: c.onSurface, fontSize: 14, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(color: c.surfaceContainer, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.outlineVariant.withValues(alpha: 0.3))),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _planId,
              isExpanded: true,
              hint: Text(_plans.isEmpty ? 'No plans — add from web dashboard' : 'Select plan', style: TextStyle(color: c.onSurfaceVariant)),
              dropdownColor: c.surfaceContainerLowest,
              style: TextStyle(color: c.onSurface, fontFamily: 'PlusJakartaSans', fontSize: 14),
              items: _plans.map((p) {
                final price = asNum(p['price']);
                final months = asNum(p['durationMonths']).toInt();
                return DropdownMenuItem(
                  value: p['id'] as String,
                  child: Text('${p['name']}${price > 0 ? ' — ${rupees(price)}' : ''}${months > 0 ? ' (${months}m)' : ''}', overflow: TextOverflow.ellipsis),
                );
              }).toList(),
              onChanged: (id) {
                final p = _plans.firstWhere((e) => e['id'] == id);
                setState(() => _applyPlan(p));
              },
            ),
          ),
        ),
      ]),
    );
  }

  Widget _feesRow() {
    final c = context.c;
    Widget box(String label, Widget value, String sub) => Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: TextStyle(color: c.onSurface, fontSize: 13, fontWeight: FontWeight.w500)),
            const SizedBox(height: 6),
            value,
            const SizedBox(height: 4),
            Text(sub, style: TextStyle(color: c.onSurfaceVariant, fontSize: 11)),
          ]),
        );
    final balancePos = _balance > 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        box(
          'Grand Total (₹)',
          _readonlyBox(_finalTotal > 0 ? rupees(_finalTotal) : '—', c.surfaceContainer, c.onSurfaceVariant),
          _joiningFeesAmt > 0
              ? 'Plan ${rupees(_discountedTotal)} + Joining ${rupees(_joiningFeesAmt)}'
              : _discountPct > 0
                  ? 'After ${_discountPct.toInt()}% discount'
                  : 'Plan price',
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Paid (₹) *', style: TextStyle(color: c.onSurface, fontSize: 13, fontWeight: FontWeight.w500)),
            const SizedBox(height: 6),
            SizedBox(
              height: 46,
              child: TextField(
                controller: _paidNow,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                onChanged: (_) => setState(() {}),
                style: TextStyle(color: c.onSurface, fontSize: 13),
                decoration: _inputDec('0').copyWith(enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: c.primary.withValues(alpha: 0.5)))),
              ),
            ),
            const SizedBox(height: 4),
            Text('Paying now', style: TextStyle(color: c.onSurfaceVariant, fontSize: 11)),
          ]),
        ),
        const SizedBox(width: 8),
        box('Balance (₹)', _readonlyBox(rupees(_balance), balancePos ? TW.rose50 : TW.green50, balancePos ? TW.rose600 : TW.green700), 'Remaining'),
      ]),
    );
  }

  Widget _readonlyBox(String text, Color bg, Color fg) => Container(
        height: 46,
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8), border: Border.all(color: fg.withValues(alpha: 0.25))),
        child: Text(text, style: TextStyle(color: fg, fontWeight: FontWeight.w600, fontSize: 13), overflow: TextOverflow.ellipsis),
      );

  Widget _summary() {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: c.primary.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(12), border: Border.all(color: c.primary.withValues(alpha: 0.2))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Sym(MSym.receiptLong, size: 24, color: c.primary),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Payment Summary', style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w600, fontSize: 14)),
            const SizedBox(height: 6),
            Wrap(spacing: 16, runSpacing: 4, children: [
              _sumItem('Total', rupees(_finalTotal), c.onSurface),
              _sumItem('Paying', rupees(_paidNum), c.primary),
              _sumItem('Balance', rupees(_balance), _balance > 0 ? TW.rose500 : TW.green600),
            ]),
            const SizedBox(height: 6),
            Text('Plan: $_planActiveFrom → $_expiryDate · $_paymentMode', style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
          ]),
        ),
      ]),
    );
  }

  Widget _sumItem(String k, String v, Color color) {
    return RichText(text: TextSpan(children: [
      TextSpan(text: '$k: ', style: TextStyle(color: context.c.onSurfaceVariant, fontSize: 14, fontFamily: 'PlusJakartaSans')),
      TextSpan(text: v, style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.w600, fontFamily: 'PlusJakartaSans')),
    ]));
  }

  InputDecoration _inputDec(String? hint) {
    final c = context.c;
    return InputDecoration(
      isDense: true,
      hintText: hint,
      hintStyle: TextStyle(color: c.onSurfaceVariant.withValues(alpha: 0.7)),
      filled: true,
      fillColor: c.surfaceContainer,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: c.outlineVariant.withValues(alpha: 0.3))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: c.primary, width: 2)),
    );
  }
}
