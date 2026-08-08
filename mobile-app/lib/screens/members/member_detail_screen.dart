import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/whatsapp_sheet.dart';
import '../payments/payment_screen.dart';

class MemberDetailScreen extends StatefulWidget {
  final Map<String, dynamic> member;
  const MemberDetailScreen({super.key, required this.member});
  @override
  State<MemberDetailScreen> createState() => _MemberDetailScreenState();
}

class _MemberDetailScreenState extends State<MemberDetailScreen> {
  late Map<String, dynamic> _m;
  List<Map<String, dynamic>> _payments = [];
  List<Map<String, dynamic>> _attendance = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _m = widget.member;
    _load();
  }

  Future<void> _load() async {
    final gymId = context.read<AuthProvider>().gymId;
    try {
      final fresh = await TenantDb.getDocument(gymId, 'members', _m['id']);
      final pays = await TenantDb.getCollection(gymId, 'payments', conditions: [Cond('memberId', '==', _m['id'])]);
      final atts = await TenantDb.getCollection(gymId, 'attendance', conditions: [Cond('memberId', '==', _m['id'])]);
      pays.sort((a, b) => (toDate(b['date']) ?? DateTime(1970)).compareTo(toDate(a['date']) ?? DateTime(1970)));
      atts.sort((a, b) => (toDate(b['checkInTime'] ?? b['timestamp']) ?? DateTime(1970)).compareTo(toDate(a['checkInTime'] ?? a['timestamp']) ?? DateTime(1970)));
      if (mounted) {
        setState(() {
          if (fresh != null) _m = fresh;
          _payments = pays;
          _attendance = atts.take(50).toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final days = daysUntilExpiry(_m['expiryDate'] as String?);
    final isFrozen = _m['status'] == 'Frozen';
    final isExpired = days != null && days < 0;
    final status = isFrozen ? 'Frozen' : isExpired ? 'Expired' : 'Active';
    final phone = _m['phone'] as String?;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        leading: IconButton(icon: Sym(MSym.arrowBack, size: 20, color: c.onSurface), onPressed: () => Navigator.pop(context)),
        title: Text('Member', style: KText.h3.copyWith(color: c.onSurface)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(KSpace.gutter),
        children: [
          KCard(
            child: Column(children: [
              Row(children: [
                InitialAvatar(name: _m['name'] as String?, size: 64, bg: c.primaryContainer, fg: c.primary),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text((_m['name'] as String?) ?? '—', style: KText.h3.copyWith(color: c.onSurface)),
                    const SizedBox(height: 2),
                    Text(phone ?? '', style: TextStyle(color: c.onSurfaceVariant)),
                    const SizedBox(height: 6),
                    _statusBadge(status),
                  ]),
                ),
              ]),
              const SizedBox(height: 16),
              const Divider(height: 1),
              const SizedBox(height: 16),
              _infoGrid(),
            ]),
          ),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: c.primary, foregroundColor: c.onPrimary, padding: const EdgeInsets.symmetric(vertical: 12)),
                onPressed: () async {
                  await Navigator.push(context, MaterialPageRoute(builder: (_) => PaymentScreen(memberId: _m['id'] as String?)));
                  _load();
                },
                icon: const Sym(MSym.payments, size: 18),
                label: const Text('Record Payment'),
              ),
            ),
            if (phone != null && phone.isNotEmpty) ...[
              const SizedBox(width: 10),
              FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: TW.whatsapp, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14)),
                onPressed: () => showWhatsAppSheet(context, phone: phone, recipientLabel: '${_m['name']} · $phone', defaultMessage: 'Hi ${_m['name']}!'),
                icon: const Icon(Icons.chat, size: 18),
                label: const Text('Chat'),
              ),
            ],
          ]),
          const SizedBox(height: 20),
          Text('Payment History', style: KText.h3.copyWith(color: c.onSurface)),
          const SizedBox(height: 10),
          if (_loading) const KLoading()
          else if (_payments.isEmpty) const KEmpty(icon: MSym.receiptLong, message: 'No payments yet.')
          else ..._payments.map(_paymentRow),
          const SizedBox(height: 20),
          Text('Attendance', style: KText.h3.copyWith(color: c.onSurface)),
          const SizedBox(height: 10),
          if (_loading) const KLoading()
          else if (_attendance.isEmpty) const KEmpty(icon: MSym.eventBusy, message: 'No check-ins yet.')
          else ..._attendance.map(_attRow),
        ],
      ),
    );
  }

  Widget _infoGrid() {
    final items = [
      ('Plan', (_m['planName'] as String?) ?? '—'),
      ('Expiry', (_m['expiryDate'] as String?) ?? '—'),
      ('Total Fees', rupees(asNum(_m['totalFees']))),
      ('Paid', rupees(asNum(_m['paidFees']))),
      ('Balance', rupees(asNum(_m['balanceFees']))),
      ('Joined', (_m['joinDate'] as String?) ?? '—'),
      if (_m['email'] != null && (_m['email'] as String).isNotEmpty) ('Email', _m['email'] as String),
      if (_m['fitnessGoal'] != null) ('Goal', _m['fitnessGoal'] as String),
    ];
    final c = context.c;
    return Column(
      children: items.map((it) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 100, child: Text(it.$1, style: TextStyle(color: c.onSurfaceVariant, fontSize: 13))),
          Expanded(child: Text(it.$2, style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w500))),
        ]),
      )).toList(),
    );
  }

  Widget _statusBadge(String status) {
    if (status == 'Frozen') return const Pill('Frozen', fg: TW.blue600, bg: TW.blue50, icon: MSym.acUnit);
    if (status == 'Active') return const Pill('Active', fg: TW.emerald600, bg: TW.emerald50, dot: true);
    return const Pill('Expired', fg: TW.rose600, bg: TW.rose50, dot: true);
  }

  Widget _paymentRow(Map<String, dynamic> p) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: KCard(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text((p['planName'] as String?) ?? '—', style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w600)),
              Text('${fmtDate(p['date'])} · ${p['paymentMode'] ?? 'Cash'}', style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
            ]),
          ),
          Text(rupees(asNum(p['amount'])), style: const TextStyle(color: TW.emerald600, fontWeight: FontWeight.w700, fontSize: 16)),
        ]),
      ),
    );
  }

  Widget _attRow(Map<String, dynamic> a) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(children: [
        const Sym(MSym.login, size: 16, color: TW.emerald600),
        const SizedBox(width: 10),
        Expanded(child: Text(recordDate(a) ?? '—', style: TextStyle(color: c.onSurface, fontSize: 13))),
        Text(fmtTime(a['checkInTime'] ?? a['timestamp']), style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
        if (a['duration'] != null) ...[const SizedBox(width: 10), Text(fmtDuration(a['duration']), style: TextStyle(color: c.onSurfaceVariant, fontSize: 12))],
      ]),
    );
  }
}
