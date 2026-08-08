import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

const _payModes = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque'];

class PaymentScreen extends StatefulWidget {
  final String? memberId;
  const PaymentScreen({super.key, this.memberId});
  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  List<Map<String, dynamic>> _members = [];
  List<Map<String, dynamic>> _plans = [];
  Map<String, dynamic>? _selected;
  bool _loading = true;
  bool _saving = false;

  String? _memberId;
  String? _planId;
  String _planName = '';
  int _durationMonths = 1;
  num _totalFees = 0;
  String _paymentMode = 'Cash';
  late String _planActiveFrom;
  late String _expiryDate;
  final _paidNow = TextEditingController();
  final _notes = TextEditingController();

  @override
  void initState() {
    super.initState();
    _memberId = widget.memberId;
    _planActiveFrom = todayStr();
    _expiryDate = addDays(todayStr(), 30);
    _load();
  }

  @override
  void dispose() {
    _paidNow.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final gymId = context.read<AuthProvider>().gymId;
    try {
      final res = await Future.wait([
        TenantDb.getCollection(gymId, 'members'),
        TenantDb.getCollection(gymId, 'plans'),
      ]);
      _members = res[0];
      _plans = res[1].where((p) => p['isActive'] != false).toList();
      if (_memberId == null && _plans.isNotEmpty) _applyPlan(_plans.first);
      if (_memberId != null) _loadMember(_memberId!);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  bool get _isFullyPaid =>
      _selected != null && asNum(_selected!['balanceFees']) == 0 && asNum(_selected!['paidFees']) > 0;

  num get _outstandingBase =>
      asNum(_selected?['balanceFees']) > 0 ? asNum(_selected!['balanceFees']) : _totalFees;
  num get _paidNum => num.tryParse(_paidNow.text) ?? 0;
  num get _balance => (_outstandingBase - _paidNum).clamp(0, double.infinity);

  void _applyPlan(Map<String, dynamic> p) {
    final months = asNum(p['durationMonths']).toInt();
    _planId = p['id'] as String?;
    _planName = (p['name'] as String?) ?? '';
    _durationMonths = months > 0 ? months : 1;
    _totalFees = asNum(p['price']);
    _expiryDate = addMonthsEnd(_planActiveFrom, _durationMonths);
    _paidNow.clear();
  }

  void _loadMember(String id) {
    final m = _members.firstWhere((e) => e['id'] == id, orElse: () => {});
    if (m.isEmpty) return;
    _selected = m;
    final fullyPaid = asNum(m['balanceFees']) == 0 && asNum(m['paidFees']) > 0;
    if (!fullyPaid) {
      _planName = (m['planName'] as String?) ?? _planName;
      _planActiveFrom = (m['planActiveFrom'] as String?) ?? todayStr();
      _expiryDate = (m['expiryDate'] as String?) ?? addDays(todayStr(), 30);
      _totalFees = asNum(m['totalFees']);
      _planId = null;
    } else {
      final matched = _plans.firstWhere((p) => p['name'] == m['planName'],
          orElse: () => _plans.isNotEmpty ? _plans.first : {});
      if (matched.isNotEmpty) {
        _applyPlan(matched);
      } else {
        _totalFees = asNum(m['totalFees']);
        _planName = (m['planName'] as String?) ?? '';
      }
      _planActiveFrom = todayStr();
      _expiryDate = addMonthsEnd(todayStr(), _durationMonths);
    }
    _paidNow.clear();
  }

  Future<void> _pickDate(String which) async {
    final init = DateTime.tryParse(which == 'active' ? _planActiveFrom : _expiryDate) ?? DateTime.now();
    final picked = await showDatePicker(context: context, initialDate: init, firstDate: DateTime(2020), lastDate: DateTime(2100));
    if (picked == null) return;
    final iso = picked.toIso8601String().split('T').first;
    setState(() {
      if (which == 'active') { _planActiveFrom = iso; _expiryDate = addMonthsEnd(iso, _durationMonths); }
      else _expiryDate = iso;
    });
  }

  Future<void> _submit() async {
    if (_memberId == null) { _toast('Please select a member'); return; }
    if (_paidNum <= 0) { _toast('Enter a valid paid amount'); return; }
    final gymId = context.read<AuthProvider>().gymId!;
    final currentBalance = asNum(_selected?['balanceFees']) > 0 ? asNum(_selected!['balanceFees']) : _totalFees;
    final newBalance = (currentBalance - _paidNum).clamp(0, double.infinity);

    setState(() => _saving = true);
    try {
      await TenantDb.createDocument(gymId, 'payments', {
        'memberId': _memberId,
        'memberName': _selected?['name'] ?? '',
        'memberPhone': _selected?['phone'] ?? '',
        'planName': _planName,
        'planActiveFrom': _planActiveFrom,
        'expiryDate': _expiryDate,
        'totalFees': _totalFees,
        'paidAmount': _paidNum,
        'amount': _paidNum,
        'balanceFees': newBalance,
        'paymentMode': _paymentMode,
        'notes': _notes.text,
        'date': DateTime.now().toIso8601String(),
        'status': 'Paid',
      });
      await TenantDb.updateDocument(gymId, 'members', _memberId!, {
        'planName': _planName,
        'planActiveFrom': _planActiveFrom,
        'expiryDate': _expiryDate,
        'status': 'Active',
        'totalFees': _totalFees,
        'paidFees': asNum(_selected?['paidFees']) + _paidNum,
        'balanceFees': newBalance,
      });
      if (mounted) { _toast('Payment recorded!'); Navigator.pop(context); }
    } catch (_) {
      _toast('Failed to process payment');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final locked = _selected != null && !_isFullyPaid;
    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        leading: IconButton(icon: Sym(MSym.arrowBack, size: 20, color: c.onSurface), onPressed: () => Navigator.pop(context)),
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text('Record Payment', style: KText.h3.copyWith(color: c.onSurface)),
          Text('Process a payment and activate the member plan', style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
        ]),
      ),
      body: _loading
          ? const Center(child: KSpinner(size: 36))
          : ListView(
              padding: const EdgeInsets.all(KSpace.gutter),
              children: [
                KCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('Select Member *'),
                    const SizedBox(height: 6),
                    _memberDropdown(),
                    if (_selected != null) ...[const SizedBox(height: 16), _memberInfo()],
                    if (_isFullyPaid) ...[const SizedBox(height: 12), _fullyPaidBanner()],
                    const Divider(height: 32),
                    _sectionTitle(MSym.cardMembership, 'Plan Details'),
                    const SizedBox(height: 12),
                    _label('Membership Plan'),
                    const SizedBox(height: 6),
                    if (locked) _lockedPlan() else _planDropdown(),
                    const SizedBox(height: 16),
                    _feesRow(),
                    const SizedBox(height: 8),
                    _dropdown('Payment Mode', _paymentMode, _payModes, (v) => setState(() => _paymentMode = v!)),
                    _label('Notes (optional)'),
                    const SizedBox(height: 6),
                    TextField(controller: _notes, style: TextStyle(color: c.onSurface), decoration: _dec().copyWith(hintText: 'e.g. Renewal, Annual offer')),
                    const Divider(height: 32),
                    _sectionTitle(MSym.calendarMonth, 'Plan Duration'),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: _dateField('Active From', _planActiveFrom, () => _pickDate('active'))),
                      const SizedBox(width: 12),
                      Expanded(child: _dateField('Expiry Date', _expiryDate, () => _pickDate('expiry'))),
                    ]),
                    const SizedBox(height: 8),
                    _summary(),
                  ]),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  height: 50,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: c.primary, foregroundColor: c.onPrimary),
                    onPressed: _saving ? null : _submit,
                    icon: _saving ? const KSpinner(size: 18, color: Colors.white) : const Sym(MSym.payments, size: 18),
                    label: Text(_saving ? 'Processing...' : 'Record Payment'),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _label(String t) => Text(t, style: TextStyle(color: context.c.onSurface, fontSize: 14, fontWeight: FontWeight.w500));

  Widget _sectionTitle(IconData icon, String t) {
    final c = context.c;
    return Row(children: [
      Sym(icon, size: 16, color: c.onSurfaceVariant),
      const SizedBox(width: 8),
      Text(t.toUpperCase(), style: KText.labelCaps.copyWith(color: c.onSurfaceVariant, letterSpacing: 1)),
    ]);
  }

  Widget _memberDropdown() {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(color: c.surfaceContainer, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.outlineVariant.withValues(alpha: 0.3))),
      child: DropdownButtonHideUnderline(child: DropdownButton<String>(
        value: _memberId,
        isExpanded: true,
        hint: Text('-- Choose Member --', style: TextStyle(color: c.onSurfaceVariant)),
        dropdownColor: c.surfaceContainerLowest,
        style: TextStyle(color: c.onSurface, fontFamily: 'PlusJakartaSans', fontSize: 14),
        items: _members.map((m) => DropdownMenuItem(value: m['id'] as String, child: Text('${m['name']} (${m['phone']})', overflow: TextOverflow.ellipsis))).toList(),
        onChanged: (id) => setState(() { _memberId = id; if (id != null) _loadMember(id); }),
      )),
    );
  }

  Widget _memberInfo() {
    final c = context.c;
    final m = _selected!;
    final active = m['status'] == 'Active';
    final bal = asNum(m['balanceFees']);
    return Container(
      decoration: BoxDecoration(color: c.surfaceContainer, borderRadius: BorderRadius.circular(12), border: Border.all(color: c.outlineVariant.withValues(alpha: 0.3))),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          color: c.primary.withValues(alpha: 0.05),
          child: Row(children: [
            Sym(MSym.accountCircle, size: 18, color: c.primary, fill: true),
            const SizedBox(width: 8),
            Expanded(child: Text('${m['name']} · ${m['phone']}', style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w600, fontSize: 13), overflow: TextOverflow.ellipsis)),
            Pill(m['status']?.toString() ?? 'Unknown', fg: active ? TW.green700 : TW.rose600, bg: active ? TW.green100 : TW.rose100),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            _infoCol('Current Plan', (m['planName'] as String?) ?? '—'),
            _infoCol('Expiry', (m['expiryDate'] as String?) ?? '—'),
            _infoCol('Outstanding', bal > 0 ? rupees(bal) : 'Cleared', color: bal > 0 ? TW.rose500 : TW.green600),
          ]),
        ),
      ]),
    );
  }

  Widget _infoCol(String label, String value, {Color? color}) {
    final c = context.c;
    return Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: TextStyle(color: c.onSurfaceVariant, fontSize: 11)),
      const SizedBox(height: 2),
      Text(value, style: TextStyle(color: color ?? c.onSurface, fontWeight: FontWeight.w600, fontSize: 13), overflow: TextOverflow.ellipsis),
    ]));
  }

  Widget _fullyPaidBanner() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: TW.green50, borderRadius: BorderRadius.circular(12), border: Border.all(color: TW.green200)),
      child: Row(children: [
        const Sym(MSym.checkCircle, size: 24, color: TW.green600, fill: true),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
          Text('Fees Fully Paid', style: TextStyle(color: TW.green700, fontWeight: FontWeight.w600, fontSize: 14)),
          SizedBox(height: 2),
          Text('No outstanding balance. Select a new plan below to record a renewal.', style: TextStyle(color: TW.green600, fontSize: 12)),
        ])),
      ]),
    );
  }

  Widget _lockedPlan() {
    final c = context.c;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: TW.amber50, borderRadius: BorderRadius.circular(999), border: Border.all(color: TW.amber200)),
          child: const Row(mainAxisSize: MainAxisSize.min, children: [
            Sym(MSym.lock, size: 12, color: TW.amber600),
            SizedBox(width: 4),
            Text('Locked — clear balance first', style: TextStyle(color: TW.amber700, fontSize: 11)),
          ]),
        ),
      ]),
      const SizedBox(height: 6),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: c.surfaceContainer, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.outlineVariant.withValues(alpha: 0.2))),
        child: Row(children: [
          Sym(MSym.cardMembership, size: 16, color: c.onSurfaceVariant),
          const SizedBox(width: 8),
          Text(_planName.isNotEmpty ? _planName : '—', style: TextStyle(color: c.onSurfaceVariant, fontWeight: FontWeight.w600)),
        ]),
      ),
    ]);
  }

  Widget _planDropdown() {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(color: c.surfaceContainer, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.outlineVariant.withValues(alpha: 0.3))),
      child: DropdownButtonHideUnderline(child: DropdownButton<String>(
        value: _planId,
        isExpanded: true,
        hint: Text(_plans.isEmpty ? 'No plans' : 'Select plan', style: TextStyle(color: c.onSurfaceVariant)),
        dropdownColor: c.surfaceContainerLowest,
        style: TextStyle(color: c.onSurface, fontFamily: 'PlusJakartaSans', fontSize: 14),
        items: _plans.map((p) {
          final price = asNum(p['price']);
          final months = asNum(p['durationMonths']).toInt();
          return DropdownMenuItem(value: p['id'] as String, child: Text('${p['name']}${price > 0 ? ' — ${rupees(price)}' : ''}${months > 0 ? ' (${months}m)' : ''}', overflow: TextOverflow.ellipsis));
        }).toList(),
        onChanged: (id) { final p = _plans.firstWhere((e) => e['id'] == id); setState(() => _applyPlan(p)); },
      )),
    );
  }

  Widget _feesRow() {
    final c = context.c;
    final balancePos = _balance > 0;
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Total (₹)', style: TextStyle(color: c.onSurface, fontSize: 13, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        _ro(_totalFees > 0 ? rupees(_totalFees) : '—', c.surfaceContainer, c.onSurfaceVariant),
      ])),
      const SizedBox(width: 8),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Paid (₹) *', style: TextStyle(color: c.onSurface, fontSize: 13, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        SizedBox(height: 46, child: TextField(
          controller: _paidNow,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          onChanged: (_) => setState(() {}),
          style: TextStyle(color: c.onSurface, fontSize: 13),
          decoration: _dec().copyWith(hintText: '0', enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: c.primary.withValues(alpha: 0.5)))),
        )),
      ])),
      const SizedBox(width: 8),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Balance (₹)', style: TextStyle(color: c.onSurface, fontSize: 13, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        _ro(rupees(_balance), balancePos ? TW.rose50 : TW.green50, balancePos ? TW.rose600 : TW.green700),
      ])),
    ]);
  }

  Widget _ro(String text, Color bg, Color fg) => Container(
        height: 46, alignment: Alignment.centerLeft, padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8), border: Border.all(color: fg.withValues(alpha: 0.25))),
        child: Text(text, style: TextStyle(color: fg, fontWeight: FontWeight.w600, fontSize: 13), overflow: TextOverflow.ellipsis),
      );

  Widget _dropdown(String label, String value, List<String> items, ValueChanged<String?> onChanged) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _label(label),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(color: c.surfaceContainer, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.outlineVariant.withValues(alpha: 0.3))),
          child: DropdownButtonHideUnderline(child: DropdownButton<String>(
            value: value, isExpanded: true, dropdownColor: c.surfaceContainerLowest,
            style: TextStyle(color: c.onSurface, fontFamily: 'PlusJakartaSans', fontSize: 14),
            items: items.map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(),
            onChanged: onChanged,
          )),
        ),
      ]),
    );
  }

  Widget _dateField(String label, String value, VoidCallback onTap) {
    final c = context.c;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _label(label),
      const SizedBox(height: 6),
      InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(color: c.surfaceContainer, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.outlineVariant.withValues(alpha: 0.3))),
          child: Row(children: [
            Expanded(child: Text(value, style: TextStyle(color: c.onSurface), overflow: TextOverflow.ellipsis)),
            Sym(MSym.calendarMonth, size: 18, color: c.onSurfaceVariant),
          ]),
        ),
      ),
    ]);
  }

  Widget _summary() {
    final c = context.c;
    final days = ((DateTime.tryParse(_expiryDate) ?? DateTime.now()).difference(DateTime.tryParse(_planActiveFrom) ?? DateTime.now()).inDays);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: c.primary.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(12), border: Border.all(color: c.primary.withValues(alpha: 0.2))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Sym(MSym.receiptLong, size: 24, color: c.primary),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Payment Summary', style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(height: 6),
          Wrap(spacing: 16, runSpacing: 4, children: [
            if (_selected != null && asNum(_selected!['paidFees']) > 0) _sum('Already Paid', rupees(asNum(_selected!['paidFees'])), TW.green600),
            _sum('Outstanding', rupees(_outstandingBase), c.onSurface),
            _sum('Paying', rupees(_paidNum), c.primary),
            _sum('Balance', rupees(_balance), _balance > 0 ? TW.rose500 : TW.green600),
          ]),
          const SizedBox(height: 6),
          Text('Plan: $_planActiveFrom → $_expiryDate ($days days) · $_paymentMode', style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
        ])),
      ]),
    );
  }

  Widget _sum(String k, String v, Color color) => RichText(text: TextSpan(children: [
        TextSpan(text: '$k: ', style: TextStyle(color: context.c.onSurfaceVariant, fontSize: 14, fontFamily: 'PlusJakartaSans')),
        TextSpan(text: v, style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.w600, fontFamily: 'PlusJakartaSans')),
      ]));

  InputDecoration _dec() {
    final c = context.c;
    return InputDecoration(
      isDense: true,
      filled: true,
      fillColor: c.surfaceContainer,
      hintStyle: TextStyle(color: c.onSurfaceVariant.withValues(alpha: 0.7)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: c.outlineVariant.withValues(alpha: 0.3))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: c.primary, width: 2)),
    );
  }
}
