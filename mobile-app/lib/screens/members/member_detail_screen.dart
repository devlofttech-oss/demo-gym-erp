import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/whatsapp_sheet.dart';
import '../payments/payment_screen.dart';
import 'edit_member_screen.dart';

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
  List<Map<String, dynamic>> _opportunities = [];
  bool _loading = true;
  bool _sendingReceipt = false;

  @override
  void initState() {
    super.initState();
    _m = widget.member;
    _load();
  }

  Future<void> _load() async {
    final gymId = context.read<AuthProvider>().gymId;
    try {
      final results = await Future.wait([
        TenantDb.getDocument(gymId, 'members', _m['id']),
        TenantDb.getCollection(gymId, 'payments', conditions: [Cond('memberId', '==', _m['id'])]),
        TenantDb.getCollection(gymId, 'attendance', conditions: [Cond('memberId', '==', _m['id'])]),
        TenantDb.getCollection(gymId, 'opportunities', conditions: [Cond('memberId', '==', _m['id'])]),
      ]);
      final fresh = results[0] as Map<String, dynamic>?;
      final pays = results[1] as List<Map<String, dynamic>>;
      final atts = results[2] as List<Map<String, dynamic>>;
      final opps = results[3] as List<Map<String, dynamic>>;
      pays.sort((a, b) => (toDate(b['date']) ?? DateTime(1970)).compareTo(toDate(a['date']) ?? DateTime(1970)));
      atts.sort((a, b) => (toDate(b['checkInTime'] ?? b['timestamp']) ?? DateTime(1970)).compareTo(toDate(a['checkInTime'] ?? a['timestamp']) ?? DateTime(1970)));
      opps.sort((a, b) => (b['createdAt'] as String? ?? '').compareTo(a['createdAt'] as String? ?? ''));
      if (mounted) {
        setState(() {
          if (fresh != null) _m = fresh;
          _payments = pays;
          _attendance = atts.take(50).toList();
          _opportunities = opps;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  static const _kReceiptBase = 'https://gym-erp-demo.web.app';

  String _receiptUrl() => '$_kReceiptBase/receipt/${_m['id'] ?? ''}';

  Future<void> _viewReceipt() async {
    final url = Uri.parse(_receiptUrl());
    if (await canLaunchUrl(url)) await launchUrl(url, mode: LaunchMode.externalApplication);
  }

  Future<void> _sendReceiptWhatsApp() async {
    final phone = _m['phone'] as String?;
    if (phone == null || phone.isEmpty) return;
    if (!mounted) return;
    setState(() => _sendingReceipt = true);
    try {
      final auth = context.read<AuthProvider>();
      final gymId = auth.gymId ?? '';
      final gymData = auth.gymData ?? {};
      final memberId = _m['id'] as String? ?? '';
      await TenantDb.setRootDocument('receipts', memberId, {
        'gymName': gymData['name'] ?? '',
        'gymAddress': gymData['location'] ?? gymData['address'] ?? '',
        'gymPhone': gymData['contact'] ?? gymData['phone'] ?? '',
        'gymLogoUrl': gymData['logoUrl'] ?? '',
        'memberName': _m['name'] ?? '',
        'memberPhone': _m['phone'] ?? '',
        'membershipId': _m['membershipId'] ?? '',
        'planName': _m['planName'] ?? '',
        'totalFees': (_m['totalFees'] ?? 0),
        'paidFees': (_m['paidFees'] ?? 0),
        'balanceFees': (_m['balanceFees'] ?? 0),
        'planActiveFrom': _m['planActiveFrom'] ?? '',
        'expiryDate': _m['expiryDate'] ?? '',
        'gstPercent': _m['gstPercent'] ?? 0,
        'generatedAt': DateTime.now().toIso8601String(),
        'gymId': gymId,
      });
      final receiptUrl = _receiptUrl();
      final name = (_m['name'] as String?) ?? 'there';
      final gymName = (gymData['name'] as String?) ?? 'our gym';
      final msg = 'Hi $name! 🏋️\nHere is your membership receipt from *$gymName*.\n\nView your receipt:\n$receiptUrl\n\nThank you! 💪';
      final num = phone.replaceAll(RegExp(r'\D'), '');
      final last10 = num.length > 10 ? num.substring(num.length - 10) : num;
      final waUri = Uri.parse('https://wa.me/91$last10?text=${Uri.encodeComponent(msg)}');
      if (mounted) await launchUrl(waUri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to send receipt')));
    } finally {
      if (mounted) setState(() => _sendingReceipt = false);
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
        actions: [
          IconButton(
            icon: Sym(MSym.edit, size: 20, color: c.primary),
            tooltip: 'Edit member',
            onPressed: () async {
              final updated = await Navigator.push<bool>(context,
                MaterialPageRoute(builder: (_) => EditMemberScreen(member: _m)));
              if (updated == true) _load();
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(KSpace.gutter),
        children: [
          KCard(
            child: Column(children: [
              Row(children: [
                _memberAvatar(c),
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
          const SizedBox(height: 10),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12)),
                onPressed: _viewReceipt,
                icon: const Sym(MSym.receiptLong, size: 18),
                label: const Text('View Receipt'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: TW.whatsapp, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 12)),
                onPressed: _sendingReceipt ? null : _sendReceiptWhatsApp,
                icon: _sendingReceipt ? const KSpinner(size: 16, color: Colors.white) : const Icon(Icons.receipt_long, size: 18),
                label: Text(_sendingReceipt ? 'Sending...' : 'Send Receipt'),
              ),
            ),
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
          const SizedBox(height: 20),
          Row(children: [
            Expanded(child: Text('Opportunities', style: KText.h3.copyWith(color: c.onSurface))),
            IconButton(
              icon: Sym(MSym.add, size: 20, color: c.primary),
              onPressed: () => _showOppSheet(context, c),
              tooltip: 'Add opportunity',
            ),
          ]),
          const SizedBox(height: 6),
          if (_loading) const KLoading()
          else if (_opportunities.isEmpty)
            KEmpty(icon: MSym.sell, message: 'No upsell opportunities tracked yet.')
          else ..._opportunities.map((o) => _oppCard(o, c)),
          const SizedBox(height: 20),
          Text('Member QR', style: KText.h3.copyWith(color: c.onSurface)),
          const SizedBox(height: 10),
          _qrSection(c),
        ],
      ),
    );
  }

  Widget _memberAvatar(AppColors c) {
    final photoUrl = _m['photoUrl'] as String?;
    if (photoUrl != null && photoUrl.isNotEmpty) {
      return ClipOval(
        child: Image.network(
          photoUrl,
          width: 64,
          height: 64,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => InitialAvatar(
              name: _m['name'] as String?,
              size: 64,
              bg: c.primaryContainer,
              fg: c.primary),
        ),
      );
    }
    return InitialAvatar(
        name: _m['name'] as String?, size: 64, bg: c.primaryContainer, fg: c.primary);
  }

  Widget _qrSection(AppColors c) {
    final memberId = _m['id'] as String? ?? '';
    if (memberId.isEmpty) return const SizedBox.shrink();
    final qrData = 'kilos:member:$memberId';
    return KCard(
      child: Column(
        children: [
          QrImageView(
            data: qrData,
            version: QrVersions.auto,
            size: 180,
            backgroundColor: Colors.white,
            errorCorrectionLevel: QrErrorCorrectLevel.M,
          ),
          const SizedBox(height: 10),
          Text(
            _m['name'] as String? ?? '—',
            style: KText.h3.copyWith(color: c.onSurface),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            memberId,
            style: TextStyle(
                color: c.onSurfaceVariant, fontSize: 11, fontFamily: 'monospace'),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            icon: const Sym(MSym.qrCodeScanner, size: 16),
            label: const Text('Copy Member ID'),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: memberId));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Member ID copied')),
              );
            },
          ),
        ],
      ),
    );
  }

  Color _oppStatusColor(String s) {
    if (s == 'Won') return TW.emerald600;
    if (s == 'Lost') return TW.rose600;
    return TW.amber600;
  }

  Color _oppStatusBg(String s) {
    if (s == 'Won') return TW.emerald50;
    if (s == 'Lost') return TW.rose50;
    return TW.amber50;
  }

  IconData _oppTypeIcon(String t) {
    switch (t) {
      case 'PT Package': return MSym.fitnessCenter;
      case 'Plan Upgrade': return MSym.loyalty;
      case 'Supplement': return MSym.medication;
      default: return MSym.sell;
    }
  }

  Widget _oppCard(Map<String, dynamic> o, AppColors c) {
    final status = o['status'] as String? ?? 'Open';
    final type = o['type'] as String? ?? 'Other';
    final gymId = context.read<AuthProvider>().gymId ?? '';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: KCard(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Container(
                width: 32, height: 32,
                decoration: BoxDecoration(
                  color: _oppStatusColor(status).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Sym(_oppTypeIcon(type), size: 16, color: _oppStatusColor(status)),
              ),
              const SizedBox(width: 10),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(o['title'] as String? ?? type,
                      style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w600)),
                  Text(type, style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
                ],
              )),
              Pill(status, fg: _oppStatusColor(status), bg: _oppStatusBg(status), dot: true),
            ]),
            if ((o['notes'] as String? ?? '').isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(o['notes'] as String, style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
            ],
            const SizedBox(height: 10),
            Row(children: [
              if (asNum(o['amount']) > 0)
                Text(rupees(asNum(o['amount'])),
                    style: const TextStyle(color: TW.emerald600, fontWeight: FontWeight.w700)),
              const Spacer(),
              if (status == 'Open') ...[
                OutlinedButton(
                  onPressed: () => _setOppStatus(gymId, o, 'Won'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: TW.emerald600,
                    side: const BorderSide(color: TW.emerald600),
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    minimumSize: const Size(0, 30),
                  ),
                  child: const Text('Won', style: TextStyle(fontSize: 12)),
                ),
                const SizedBox(width: 6),
                OutlinedButton(
                  onPressed: () => _setOppStatus(gymId, o, 'Lost'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: TW.rose600,
                    side: const BorderSide(color: TW.rose600),
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    minimumSize: const Size(0, 30),
                  ),
                  child: const Text('Lost', style: TextStyle(fontSize: 12)),
                ),
                const SizedBox(width: 6),
              ],
              IconButton(
                icon: Sym(MSym.edit, size: 16, color: c.onSurfaceVariant),
                onPressed: () => _showOppSheet(context, c, existing: o),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
              ),
              IconButton(
                icon: const Sym(MSym.close, size: 16, color: TW.rose600),
                onPressed: () => _deleteOpp(gymId, o['id'] as String),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
              ),
            ]),
          ],
        ),
      ),
    );
  }

  Future<void> _setOppStatus(String gymId, Map<String, dynamic> o, String status) async {
    await TenantDb.updateDocument(gymId, 'opportunities', o['id'] as String, {'status': status});
    _load();
  }

  Future<void> _deleteOpp(String gymId, String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Opportunity'),
        content: const Text('Remove this opportunity? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: TW.rose600),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok == true) {
      await TenantDb.deleteDocument(gymId, 'opportunities', id);
      _load();
    }
  }

  void _showOppSheet(BuildContext context, AppColors c, {Map<String, dynamic>? existing}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _OppSheet(
        memberId: _m['id'] as String? ?? '',
        memberName: _m['name'] as String? ?? '',
        gymId: context.read<AuthProvider>().gymId ?? '',
        existing: existing,
        onSaved: _load,
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

  Future<void> _deletePayment(String id) async {
    final gymId = context.read<AuthProvider>().gymId ?? '';
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Payment'),
        content: const Text('Remove this payment record?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: TW.rose600),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok == true) {
      await TenantDb.deleteDocument(gymId, 'payments', id);
      _load();
    }
  }

  Future<void> _deleteAttendance(String id) async {
    final gymId = context.read<AuthProvider>().gymId ?? '';
    await TenantDb.deleteDocument(gymId, 'attendance', id);
    _load();
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
          const SizedBox(width: 4),
          IconButton(
            icon: const Sym(MSym.deleteOutline, size: 16, color: TW.rose600),
            onPressed: () => _deletePayment(p['id'] as String? ?? ''),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
          ),
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
        const SizedBox(width: 4),
        IconButton(
          icon: const Sym(MSym.deleteOutline, size: 14, color: TW.rose600),
          onPressed: () => _deleteAttendance(a['id'] as String? ?? ''),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
        ),
      ]),
    );
  }
}

// ─── Opportunity add/edit bottom sheet ────────────────────────────────────────

class _OppSheet extends StatefulWidget {
  final String memberId;
  final String memberName;
  final String gymId;
  final Map<String, dynamic>? existing;
  final VoidCallback onSaved;

  const _OppSheet({
    required this.memberId,
    required this.memberName,
    required this.gymId,
    this.existing,
    required this.onSaved,
  });

  @override
  State<_OppSheet> createState() => _OppSheetState();
}

class _OppSheetState extends State<_OppSheet> {
  final _title = TextEditingController();
  final _amount = TextEditingController();
  final _notes = TextEditingController();
  String _type = 'PT Package';
  String _status = 'Open';
  bool _saving = false;

  static const _types = ['PT Package', 'Plan Upgrade', 'Supplement', 'Other'];
  static const _statuses = ['Open', 'Won', 'Lost'];

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _title.text = e['title'] as String? ?? '';
      _amount.text = asNum(e['amount']) > 0 ? asNum(e['amount']).toString() : '';
      _notes.text = e['notes'] as String? ?? '';
      _type = e['type'] as String? ?? 'PT Package';
      _status = e['status'] as String? ?? 'Open';
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _amount.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final data = {
      'memberId': widget.memberId,
      'memberName': widget.memberName,
      'type': _type,
      'title': _title.text.trim().isEmpty ? _type : _title.text.trim(),
      'amount': num.tryParse(_amount.text) ?? 0,
      'notes': _notes.text.trim(),
      'status': _status,
      if (widget.existing == null) 'createdAt': DateTime.now().toIso8601String(),
    };
    try {
      if (widget.existing != null) {
        await TenantDb.updateDocument(
            widget.gymId, 'opportunities', widget.existing!['id'] as String, data);
      } else {
        await TenantDb.createDocument(widget.gymId, 'opportunities', data);
      }
      if (mounted) {
        widget.onSaved();
        Navigator.pop(context);
      }
    } catch (_) {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isEdit = widget.existing != null;

    return Container(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                  width: 36, height: 4,
                  decoration: BoxDecoration(color: TW.slate200, borderRadius: BorderRadius.circular(2))),
            ),
            const SizedBox(height: 16),
            Text(isEdit ? 'Edit Opportunity' : 'Add Opportunity',
                style: KText.h3.copyWith(color: c.onSurface)),
            Text(widget.memberName,
                style: TextStyle(color: c.onSurfaceVariant, fontSize: 13)),
            const SizedBox(height: 20),

            Text('Type', style: TextStyle(color: c.onSurface, fontSize: 13, fontWeight: FontWeight.w500)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8, runSpacing: 8,
              children: _types.map((t) => ChoiceChip(
                label: Text(t),
                selected: _type == t,
                onSelected: (_) => setState(() => _type = t),
                showCheckmark: false,
              )).toList(),
            ),
            const SizedBox(height: 16),

            _field('Title (optional)', _title,
                hint: 'e.g. 3-month PT package offer', c: c),
            _field('Potential Value (₹)', _amount,
                hint: '0', keyboard: TextInputType.number, c: c),
            _field('Notes', _notes,
                hint: 'Any context or follow-up details...', maxLines: 3, c: c),

            const SizedBox(height: 4),
            Text('Status', style: TextStyle(color: c.onSurface, fontSize: 13, fontWeight: FontWeight.w500)),
            const SizedBox(height: 8),
            Row(children: _statuses.map((s) {
              final sel = _status == s;
              Color fg = s == 'Won' ? TW.emerald600 : s == 'Lost' ? TW.rose600 : TW.amber600;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(s),
                  selected: sel,
                  onSelected: (_) => setState(() => _status = s),
                  showCheckmark: false,
                  selectedColor: fg.withValues(alpha: 0.12),
                  labelStyle: TextStyle(color: sel ? fg : c.onSurfaceVariant,
                      fontWeight: sel ? FontWeight.w600 : FontWeight.normal),
                  side: BorderSide(color: sel ? fg : c.outlineVariant),
                ),
              );
            }).toList()),
            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(width: 16, height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Sym(MSym.save, size: 18, color: Colors.white),
                label: Text(_saving ? 'Saving…' : isEdit ? 'Update' : 'Add Opportunity'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl,
      {String? hint, TextInputType? keyboard, int maxLines = 1, required AppColors c}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(color: c.onSurface, fontSize: 13, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          keyboardType: keyboard,
          maxLines: maxLines,
          decoration: InputDecoration(
            hintText: hint,
            border: const OutlineInputBorder(),
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
        ),
      ]),
    );
  }
}
