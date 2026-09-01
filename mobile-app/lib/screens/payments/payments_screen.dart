import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/whatsapp_api_sheet.dart';
import '../members/member_detail_screen.dart';
import 'payment_screen.dart';

const _payModes = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque'];

class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});
  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  List<Map<String, dynamic>> _payments = [];
  List<Map<String, dynamic>> _members = [];
  bool _loading = true;
  int _tab = 0; // 0 payments, 1 dues
  String _search = '';
  String? _filterMonth; // 'YYYY-MM'
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    final gymId = context.read<AuthProvider>().gymId;
    try {
      final res = await Future.wait([
        TenantDb.getCollection(gymId, 'payments'),
        TenantDb.getCollection(gymId, 'members'),
      ]);
      final pays = res[0]..sort((a, b) => (toDate(b['date']) ?? DateTime(1970)).compareTo(toDate(a['date']) ?? DateTime(1970)));
      if (mounted) setState(() { _payments = pays; _members = res[1]; });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  num get _totalRevenue => _payments.fold<num>(0, (s, p) => s + asNum(p['amount']));

  bool _thisMonth(dynamic d) {
    final dt = toDate(d);
    final now = DateTime.now();
    return dt != null && dt.month == now.month && dt.year == now.year;
  }

  List<Map<String, dynamic>> get _filteredPayments {
    final term = _search.toLowerCase();
    return _payments.where((p) {
      if (_filterMonth != null) {
        final d = toDate(p['date']);
        if (d == null) return false;
        final mStr = '${d.year}-${d.month.toString().padLeft(2, '0')}';
        if (mStr != _filterMonth) return false;
      }
      if (term.isEmpty) return true;
      return ((p['memberName'] as String?)?.toLowerCase().contains(term) ?? false) ||
          ((p['planName'] as String?)?.toLowerCase().contains(term) ?? false) ||
          ((p['paymentMode'] as String?)?.toLowerCase().contains(term) ?? false);
    }).toList();
  }

  List<Map<String, dynamic>> get _duesMembers => _members.where((m) {
        final days = daysUntilExpiry(m['expiryDate'] as String?);
        return m['status'] == 'Expired' || (days != null && days < 0) || (m['planName'] == null || (m['planName'] as String).isEmpty);
      }).toList();

  List<Map<String, dynamic>> get _filteredDues {
    final term = _search.toLowerCase();
    return _duesMembers.where((m) {
      if (term.isEmpty) return true;
      return ((m['name'] as String?)?.toLowerCase().contains(term) ?? false) ||
          ((m['phone'] as String?)?.contains(term) ?? false);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async { setState(() => _loading = true); await _fetch(); },
      child: ListView(
        padding: const EdgeInsets.all(KSpace.gutter),
        children: [
          PageHeader('Payments', 'Track payments, dues, and expired memberships.',
              trailing: _recordBtn()),
          const SizedBox(height: 16),
          _tabs(),
          const SizedBox(height: 16),
          if (_tab == 0) ..._paymentsTab() else ..._duesTab(),
        ],
      ),
    );
  }

  Widget _recordBtn() {
    final c = context.c;
    return Material(
      color: c.primary,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () async {
          await Navigator.push(context, MaterialPageRoute(builder: (_) => const PaymentScreen()));
          setState(() => _loading = true);
          _fetch();
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Sym(MSym.add, size: 18, color: c.onPrimary),
            const SizedBox(width: 4),
            Text('Record', style: TextStyle(color: c.onPrimary, fontWeight: FontWeight.w500)),
          ]),
        ),
      ),
    );
  }

  Widget _tabs() {
    final c = context.c;
    Widget tab(int i, IconData icon, String label, {int? badge}) {
      final active = _tab == i;
      return Expanded(
        child: Material(
          color: active ? c.surfaceContainerLowest : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          child: InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: () { setState(() { _tab = i; _search = ''; _filterMonth = null; _searchCtrl.clear(); }); },
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              alignment: Alignment.center,
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Sym(icon, size: 16, color: active ? c.onSurface : c.onSurfaceVariant),
                const SizedBox(width: 6),
                Text(label, style: TextStyle(color: active ? c.onSurface : c.onSurfaceVariant, fontWeight: FontWeight.w500, fontSize: 13)),
                if (badge != null && badge > 0) ...[
                  const SizedBox(width: 6),
                  Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1), decoration: const BoxDecoration(color: TW.rose500, borderRadius: BorderRadius.all(Radius.circular(999))), child: Text('$badge', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700))),
                ],
              ]),
            ),
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: c.surfaceContainer, borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        tab(0, MSym.receiptLong, 'All Payments'),
        tab(1, MSym.warning, 'Dues & Expired', badge: _duesMembers.length),
      ]),
    );
  }

  List<Widget> _paymentsTab() {
    final c = context.c;
    final thisMonthCount = _payments.where((p) => _thisMonth(p['date'])).length;
    final thisMonthSum = _payments.where((p) => _thisMonth(p['date'])).fold<num>(0, (s, p) => s + asNum(p['amount']));
    final filtered = _filteredPayments;
    return [
      KCard(
        child: Wrap(
          spacing: 28, runSpacing: 16,
          children: [
            _summaryItem('Total Revenue', rupees(_totalRevenue), TW.emerald600),
            _summaryItem('Total Payments', '${_payments.length}', c.onSurface),
            _summaryItem('This Month', '$thisMonthCount', c.onSurface),
            _summaryItem('Paid This Month', rupees(thisMonthSum), TW.emerald600),
          ],
        ),
      ),
      const SizedBox(height: 12),
      _monthFilter(),
      const SizedBox(height: 12),
      _searchBar('Search by member, plan, mode...'),
      const SizedBox(height: 12),
      if (_loading) const KLoading()
      else if (filtered.isEmpty) const KEmpty(icon: MSym.receiptLong, message: 'No payments found')
      else ...filtered.map(_paymentCard),
    ];
  }

  Widget _monthFilter() {
    final c = context.c;
    final now = DateTime.now();
    final months = List.generate(12, (i) {
      final d = DateTime(now.year, now.month - i, 1);
      return '${d.year}-${d.month.toString().padLeft(2, '0')}';
    });
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _monthChip(c, null, 'All'),
          ...months.map((m) {
            final d = DateTime.tryParse('$m-01');
            final label = d != null ? DateFormat('MMM yyyy').format(d) : m;
            return _monthChip(c, m, label);
          }),
        ],
      ),
    );
  }

  Widget _monthChip(AppColors c, String? value, String label) {
    final active = _filterMonth == value;
    return GestureDetector(
      onTap: () => setState(() => _filterMonth = value),
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active ? c.primary : c.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: active ? c.primary : c.outlineVariant.withValues(alpha: 0.3)),
        ),
        child: Text(label, style: TextStyle(
          color: active ? c.onPrimary : c.onSurface,
          fontWeight: FontWeight.w500,
          fontSize: 13,
        )),
      ),
    );
  }

  Widget _summaryItem(String label, String value, Color color) {
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label.toUpperCase(), style: KText.labelCaps.copyWith(color: c.onSurfaceVariant, letterSpacing: 0.5)),
        const SizedBox(height: 4),
        Text(value, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 26)),
      ],
    );
  }

  final _modeColors = {
    'Cash': (TW.emerald700, TW.emerald100),
    'Card': (TW.blue700, TW.blue100),
    'UPI': (TW.purple700, TW.purple100),
    'Bank Transfer': (TW.amber700, TW.amber100),
    'Cheque': (TW.slate700, TW.slate100),
  };

  Widget _paymentCard(Map<String, dynamic> p) {
    final c = context.c;
    final mode = (p['paymentMode'] as String?) ?? 'Cash';
    final mc = _modeColors[mode] ?? (TW.slate700, TW.slate100);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: KCard(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            InitialAvatar(name: p['memberName'] as String?, size: 36, bg: c.primaryContainer, fg: c.primary),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text((p['memberName'] as String?) ?? '—', style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w600)),
              Text((p['memberPhone'] as String?) ?? '', style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
            ])),
            Text(rupees(asNum(p['amount'])), style: const TextStyle(color: TW.emerald600, fontWeight: FontWeight.w700, fontSize: 18)),
          ]),
          const SizedBox(height: 12),
          _kv('Plan', (p['planName'] as String?) ?? '—'),
          _kv('Expiry', fmtDate(p['expiryDate'])),
          _kv('Date', fmtDate(p['date'])),
          Row(children: [
            SizedBox(width: 70, child: Text('Mode', style: TextStyle(color: c.onSurfaceVariant, fontSize: 14))),
            Pill(mode, fg: mc.$1, bg: mc.$2),
          ]),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _editPayment(p),
              style: OutlinedButton.styleFrom(foregroundColor: c.primary, side: BorderSide(color: c.primary.withValues(alpha: 0.3))),
              icon: const Sym(MSym.edit, size: 16),
              label: const Text('Edit'),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _kv(String k, String v) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(children: [
        SizedBox(width: 70, child: Text(k, style: TextStyle(color: c.onSurfaceVariant, fontSize: 14))),
        Expanded(child: Text(v, style: TextStyle(color: c.onSurface), overflow: TextOverflow.ellipsis)),
      ]),
    );
  }

  List<Widget> _duesTab() {
    final filtered = _filteredDues;
    return [
      if (!_loading && _duesMembers.isNotEmpty)
        Container(
          padding: const EdgeInsets.all(16),
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(color: TW.rose50, borderRadius: BorderRadius.circular(16), border: Border.all(color: TW.rose200)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Sym(MSym.error, size: 22, color: TW.rose500, fill: true),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${_duesMembers.length} member${_duesMembers.length > 1 ? 's' : ''} with expired or missing memberships', style: const TextStyle(color: TW.rose700, fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              const Text('Send WhatsApp reminders or renew their plans directly.', style: TextStyle(color: TW.rose600, fontSize: 13)),
            ])),
          ]),
        ),
      _searchBar('Search by name or phone...'),
      const SizedBox(height: 12),
      if (_loading) const KLoading()
      else if (filtered.isEmpty) const KEmpty(icon: MSym.checkCircle, iconColor: TW.emerald500, message: 'No dues! All members are up to date.')
      else ...filtered.map(_duesCard),
    ];
  }

  Widget _duesCard(Map<String, dynamic> m) {
    final c = context.c;
    final days = daysUntilExpiry(m['expiryDate'] as String?);
    final overdue = days != null ? days.abs() : null;
    final phone = m['phone'] as String?;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: KCard(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            InitialAvatar(name: m['name'] as String?, size: 36, bg: TW.rose100, fg: TW.rose600),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text((m['name'] as String?) ?? '—', style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w600)),
              Text(phone ?? '', style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
            ])),
            if (overdue != null) Pill('${overdue}d overdue', fg: TW.rose600, bg: TW.rose50),
          ]),
          const SizedBox(height: 12),
          _kv('Last Plan', (m['planName'] as String?)?.isNotEmpty == true ? m['planName'] as String : 'None'),
          Row(children: [
            SizedBox(width: 70, child: Text('Expired On', style: TextStyle(color: c.onSurfaceVariant, fontSize: 14))),
            Text(m['expiryDate'] != null ? fmtDate(m['expiryDate']) : '—', style: const TextStyle(color: TW.rose600, fontWeight: FontWeight.w500)),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            if (phone != null && phone.isNotEmpty) ...[
              Expanded(child: FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: c.primary, foregroundColor: c.onPrimary),
                onPressed: () {
                  final auth = context.read<AuthProvider>();
                  final exp = m['expiryDate'] as String?;
                  final expired = exp != null && (DateTime.tryParse(exp)?.isBefore(DateTime.now()) ?? false);
                  showWhatsAppApiSheet(context,
                      gymId: auth.gymId ?? '',
                      gymName: auth.gymName,
                      type: expired ? 'renewal' : 'payment',
                      recipients: [m],
                      recipientLabel: '${m['name']} · $phone');
                },
                icon: const Sym(MSym.sms, size: 14),
                label: const Text('WhatsApp'),
              )),
              const SizedBox(width: 8),
            ],
            Expanded(child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: TW.emerald600, foregroundColor: Colors.white),
              onPressed: () async {
                await Navigator.push(context, MaterialPageRoute(builder: (_) => PaymentScreen(memberId: m['id'] as String?)));
                setState(() => _loading = true);
                _fetch();
              },
              icon: const Sym(MSym.payments, size: 14),
              label: const Text('Renew'),
            )),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => MemberDetailScreen(member: m))),
              style: OutlinedButton.styleFrom(foregroundColor: c.primary, side: BorderSide(color: c.primary.withValues(alpha: 0.3))),
              child: const Text('View'),
            ),
          ]),
        ]),
      ),
    );
  }

  Widget _searchBar(String hint) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(color: c.surfaceContainerLowest, borderRadius: BorderRadius.circular(12), border: Border.all(color: c.outlineVariant.withValues(alpha: 0.3))),
      child: Row(children: [
        Sym(MSym.search, size: 20, color: c.onSurfaceVariant),
        const SizedBox(width: 8),
        Expanded(child: TextField(
          controller: _searchCtrl,
          onChanged: (v) => setState(() => _search = v),
          style: TextStyle(color: c.onSurface, fontSize: 14),
          decoration: InputDecoration(isDense: true, border: InputBorder.none, hintText: hint, hintStyle: TextStyle(color: c.onSurfaceVariant)),
        )),
        if (_search.isNotEmpty)
          GestureDetector(onTap: () { _searchCtrl.clear(); setState(() => _search = ''); }, child: Sym(MSym.close, size: 16, color: c.onSurfaceVariant)),
      ]),
    );
  }

  Future<void> _editPayment(Map<String, dynamic> p) async {
    final c = context.c;
    String mode = (p['paymentMode'] as String?) ?? 'Cash';
    final amount = TextEditingController(text: asNum(p['amount']).toString());
    final notes = TextEditingController(text: (p['notes'] as String?) ?? '');
    bool saving = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSt) {
        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: Container(
            decoration: BoxDecoration(color: c.surfaceContainerLowest, borderRadius: const BorderRadius.vertical(top: Radius.circular(24))),
            padding: const EdgeInsets.all(20),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Sym(MSym.edit, size: 20, color: c.primary),
                const SizedBox(width: 8),
                Text('Edit Payment', style: KText.h3.copyWith(color: c.onSurface)),
                const Spacer(),
                IconButton(onPressed: () => Navigator.pop(ctx), icon: Sym(MSym.close, size: 18, color: c.onSurfaceVariant)),
              ]),
              const SizedBox(height: 12),
              Text('Payment Mode', style: TextStyle(color: c.onSurfaceVariant, fontSize: 14)),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(color: c.surfaceContainer, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.outlineVariant.withValues(alpha: 0.3))),
                child: DropdownButtonHideUnderline(child: DropdownButton<String>(
                  value: mode, isExpanded: true, dropdownColor: c.surfaceContainerLowest,
                  style: TextStyle(color: c.onSurface, fontFamily: 'PlusJakartaSans', fontSize: 14),
                  items: _payModes.map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(),
                  onChanged: (v) => setSt(() => mode = v!),
                )),
              ),
              const SizedBox(height: 12),
              Text('Amount (₹)', style: TextStyle(color: c.onSurfaceVariant, fontSize: 14)),
              const SizedBox(height: 6),
              TextField(controller: amount, keyboardType: TextInputType.number, style: TextStyle(color: c.onSurface), decoration: _dec(c)),
              const SizedBox(height: 12),
              Text('Notes', style: TextStyle(color: c.onSurfaceVariant, fontSize: 14)),
              const SizedBox(height: 6),
              TextField(controller: notes, style: TextStyle(color: c.onSurface), decoration: _dec(c).copyWith(hintText: 'e.g. Paid via PhonePe')),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: c.primary, foregroundColor: c.onPrimary, padding: const EdgeInsets.symmetric(vertical: 12)),
                  onPressed: saving ? null : () async {
                    setSt(() => saving = true);
                    final gymId = context.read<AuthProvider>().gymId!;
                    await TenantDb.updateDocument(gymId, 'payments', p['id'], {
                      'paymentMode': mode,
                      'amount': num.tryParse(amount.text) ?? 0,
                      'notes': notes.text,
                    });
                    if (ctx.mounted) Navigator.pop(ctx);
                    _fetch();
                  },
                  icon: saving ? const KSpinner(size: 16, color: Colors.white) : const Sym(MSym.save, size: 16),
                  label: Text(saving ? 'Saving...' : 'Save Changes'),
                ),
              ),
              const SizedBox(height: 8),
            ]),
          ),
        );
      }),
    );
  }

  InputDecoration _dec(AppColors c) => InputDecoration(
        isDense: true,
        filled: true,
        fillColor: c.surfaceContainer,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: c.outlineVariant.withValues(alpha: 0.3))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: c.primary, width: 2)),
      );
}
