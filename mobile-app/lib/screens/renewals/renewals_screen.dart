import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/whatsapp_api_sheet.dart';
import '../payments/payment_screen.dart';

class RenewalsScreen extends StatefulWidget {
  const RenewalsScreen({super.key});
  @override
  State<RenewalsScreen> createState() => _RenewalsScreenState();
}

class _RenewalsScreenState extends State<RenewalsScreen> {
  List<Map<String, dynamic>> _members = [];
  bool _loading = true;
  int _range = 7; // days ahead

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    final gymId = context.read<AuthProvider>().gymId;
    if (mounted) setState(() => _loading = true);
    try {
      final res = await TenantDb.getCollection(gymId, 'members');
      if (mounted) setState(() => _members = res);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _expiring {
    return _members.where((m) {
      if (m['status'] == 'Frozen') return false;
      final days = daysUntilExpiry(m['expiryDate'] as String?);
      if (days == null) return false;
      return days <= _range;
    }).toList()
      ..sort((a, b) {
        final da = daysUntilExpiry(a['expiryDate'] as String?) ?? 0;
        final db = daysUntilExpiry(b['expiryDate'] as String?) ?? 0;
        return da.compareTo(db);
      });
  }

  List<Map<String, dynamic>> get _frozen =>
      _members.where((m) => m['status'] == 'Frozen').toList();

  void _renew(Map<String, dynamic> member) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => PaymentScreen(memberId: member['id'] as String?)),
    ).then((_) => _fetch());
  }

  void _whatsApp(Map<String, dynamic> member) {
    final auth = context.read<AuthProvider>();
    showWhatsAppApiSheet(
      context,
      gymId: auth.gymId ?? '',
      gymName: auth.gymName,
      type: 'renewal',
      recipients: [member],
      recipientLabel: member['name'] ?? '',
    );
  }

  void _showFreezeSheet(Map<String, dynamic> member) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FreezeSheet(
        member: member,
        gymId: context.read<AuthProvider>().gymId ?? '',
        onSaved: _fetch,
      ),
    );
  }

  Future<void> _unfreeze(Map<String, dynamic> member) async {
    final gymId = context.read<AuthProvider>().gymId ?? '';
    final frozenOn = toDate(member['frozenOn']);
    final resume = toDate(member['resumeDate']);
    String? newExpiry;
    if (frozenOn != null && resume != null && (member['expiryDate'] as String?)?.isNotEmpty == true) {
      final frozen = resume.difference(frozenOn).inDays;
      newExpiry = addDays(member['expiryDate'] as String, frozen);
    }
    await TenantDb.updateDocument(gymId, 'members', member['id'] as String, {
      'status': 'Active',
      'frozenOn': null,
      'resumeDate': null,
      if (newExpiry != null) 'expiryDate': newExpiry,
    });
    _fetch();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final expiring = _expiring;
    final frozen = _frozen;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        leading: IconButton(
          icon: Sym(MSym.arrowBack, size: 20, color: c.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Renewals', style: KText.h3.copyWith(color: c.onSurface)),
      ),
      body: RefreshIndicator(
        onRefresh: _fetch,
        child: CustomScrollView(
          slivers: [
            // Range selector
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                child: Row(
                  children: [
                    Text('Expiring within:', style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                    const SizedBox(width: 8),
                    for (final d in [7, 14, 30]) ...[
                      const SizedBox(width: 8),
                      ChoiceChip(
                        label: Text('${d}d'),
                        selected: _range == d,
                        onSelected: (_) => setState(() => _range = d),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            // Stats row
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: Row(
                  children: [
                    _StatChip(
                      label: 'Expired',
                      count: expiring.where((m) => (daysUntilExpiry(m['expiryDate'] as String?) ?? 0) < 0).length,
                      color: TW.rose600,
                    ),
                    const SizedBox(width: 8),
                    _StatChip(
                      label: 'Expiring soon',
                      count: expiring.where((m) => (daysUntilExpiry(m['expiryDate'] as String?) ?? 0) >= 0).length,
                      color: TW.amber600,
                    ),
                    const SizedBox(width: 8),
                    _StatChip(label: 'Frozen', count: frozen.length, color: TW.blue600),
                  ],
                ),
              ),
            ),
            if (_loading)
              const SliverFillRemaining(child: KLoading())
            else ...[
              if (expiring.isEmpty && frozen.isEmpty)
                SliverFillRemaining(
                  child: KEmpty(
                    icon: MSym.autorenew,
                    message: 'No renewals due in the next $_range days',
                  ),
                )
              else ...[
                if (expiring.isNotEmpty) ...[
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                      child: Text('Due for renewal',
                          style: KText.labelCaps.copyWith(color: c.onSurfaceVariant)),
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => _RenewalCard(
                          member: expiring[i],
                          onRenew: () => _renew(expiring[i]),
                          onWhatsApp: (expiring[i]['phone'] as String?)?.isNotEmpty == true
                              ? () => _whatsApp(expiring[i])
                              : null,
                          onFreeze: () => _showFreezeSheet(expiring[i]),
                        ),
                        childCount: expiring.length,
                      ),
                    ),
                  ),
                ],
                if (frozen.isNotEmpty) ...[
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                      child: Text('Frozen members',
                          style: KText.labelCaps.copyWith(color: c.onSurfaceVariant)),
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => _FrozenCard(
                          member: frozen[i],
                          onUnfreeze: () => _unfreeze(frozen[i]),
                        ),
                        childCount: frozen.length,
                      ),
                    ),
                  ),
                ],
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  const _StatChip({required this.label, required this.count, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          Text('$count',
              style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w700,
                  fontSize: 18,
                  fontFamily: 'PlusJakartaSans')),
          Text(label,
              style: const TextStyle(
                  color: TW.slate500, fontSize: 11, fontFamily: 'PlusJakartaSans')),
        ],
      ),
    );
  }
}

class _RenewalCard extends StatelessWidget {
  final Map<String, dynamic> member;
  final VoidCallback onRenew;
  final VoidCallback? onWhatsApp;
  final VoidCallback onFreeze;
  const _RenewalCard(
      {required this.member,
      required this.onRenew,
      this.onWhatsApp,
      required this.onFreeze});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final days = daysUntilExpiry(member['expiryDate'] as String?);
    final isExpired = days != null && days < 0;
    final daysLabel = days == null
        ? '—'
        : days == 0
            ? 'Expires today'
            : isExpired
                ? 'Expired ${(-days).abs()} day${days.abs() != 1 ? 's' : ''} ago'
                : 'Expires in $days day${days != 1 ? 's' : ''}';
    final chipColor = isExpired ? TW.rose600 : TW.amber600;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: KCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                InitialAvatar(
                    name: member['name'] ?? '',
                    size: 44,
                    bg: chipColor.withValues(alpha: 0.12),
                    fg: chipColor),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(member['name'] ?? '',
                          style: KText.bodyLg.copyWith(
                              color: c.onSurface, fontWeight: FontWeight.w600)),
                      Text(member['phone'] ?? '',
                          style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                    ],
                  ),
                ),
                Pill(daysLabel,
                    bg: chipColor.withValues(alpha: 0.1), fg: chipColor, dot: true),
              ],
            ),
            if (member['plan']?.isNotEmpty == true) ...[
              const SizedBox(height: 4),
              Text('Plan: ${member['plan']}',
                  style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
            ],
            const SizedBox(height: 10),
            Row(children: [
              if (onWhatsApp != null)
                OutlinedButton.icon(
                  onPressed: onWhatsApp,
                  icon: Sym(MSym.chat, size: 14, color: TW.whatsapp),
                  label: const Text('Remind'),
                  style: OutlinedButton.styleFrom(
                      foregroundColor: TW.whatsapp,
                      side: const BorderSide(color: TW.whatsapp),
                      visualDensity: VisualDensity.compact),
                ),
              const SizedBox(width: 6),
              OutlinedButton.icon(
                onPressed: onFreeze,
                icon: Sym(MSym.acUnit, size: 14, color: TW.blue600),
                label: const Text('Freeze'),
                style: OutlinedButton.styleFrom(
                    foregroundColor: TW.blue600,
                    side: const BorderSide(color: TW.blue600),
                    visualDensity: VisualDensity.compact),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: FilledButton.icon(
                  onPressed: onRenew,
                  icon: Sym(MSym.autorenew, size: 14, color: Colors.white),
                  label: const Text('Renew'),
                  style: FilledButton.styleFrom(
                      backgroundColor: TW.emerald600,
                      visualDensity: VisualDensity.compact),
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }
}

class _FrozenCard extends StatelessWidget {
  final Map<String, dynamic> member;
  final VoidCallback onUnfreeze;
  const _FrozenCard({required this.member, required this.onUnfreeze});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final frozenOn = member['frozenOn'];
    final resume = member['resumeDate'];

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: KCard(
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: TW.blue600.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Sym(MSym.acUnit, color: TW.blue600, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(member['name'] ?? '',
                      style: KText.bodyLg.copyWith(
                          color: c.onSurface, fontWeight: FontWeight.w600)),
                  if (frozenOn != null)
                    Text('Frozen: ${fmtDate(frozenOn)}',
                        style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                  if (resume != null)
                    Text('Resumes: ${fmtDate(resume)}',
                        style: KText.bodyMd.copyWith(color: TW.blue600)),
                ],
              ),
            ),
            FilledButton(
              onPressed: onUnfreeze,
              style: FilledButton.styleFrom(
                  backgroundColor: TW.blue600, visualDensity: VisualDensity.compact),
              child: const Text('Unfreeze'),
            ),
          ],
        ),
      ),
    );
  }
}

class _FreezeSheet extends StatefulWidget {
  final Map<String, dynamic> member;
  final String gymId;
  final VoidCallback onSaved;
  const _FreezeSheet({required this.member, required this.gymId, required this.onSaved});

  @override
  State<_FreezeSheet> createState() => _FreezeSheetState();
}

class _FreezeSheetState extends State<_FreezeSheet> {
  String _frozenOn = todayStr();
  String _resumeDate = addDays(todayStr(), 30);
  bool _saving = false;

  Future<void> _pickFrozenOn() async {
    final d = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_frozenOn) ?? DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 7)),
      lastDate: DateTime.now(),
    );
    if (d != null) setState(() => _frozenOn = d.toIso8601String().split('T').first);
  }

  Future<void> _pickResume() async {
    final d = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_resumeDate) ?? DateTime.now().add(const Duration(days: 30)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (d != null) setState(() => _resumeDate = d.toIso8601String().split('T').first);
  }

  Future<void> _freeze() async {
    setState(() => _saving = true);
    try {
      await TenantDb.updateDocument(widget.gymId, 'members', widget.member['id'], {
        'status': 'Frozen',
        'frozenOn': _frozenOn,
        'resumeDate': _resumeDate,
      });
      if (mounted) Navigator.pop(context);
      widget.onSaved();
    } catch (_) {}
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(
          20, 12, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                    color: TW.slate200, borderRadius: BorderRadius.circular(2))),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Sym(MSym.acUnit, color: TW.blue600, size: 22),
              const SizedBox(width: 8),
              Text('Freeze — ${widget.member['name']}',
                  style: KText.h3.copyWith(color: c.onSurface)),
              const Spacer(),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: Sym(MSym.close, size: 20, color: c.onSurfaceVariant),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
              'The member\'s expiry date will be extended by the number of frozen days when unfrozen.',
              style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: InkWell(
                onTap: _pickFrozenOn,
                child: InputDecorator(
                  decoration: const InputDecoration(
                      labelText: 'Freeze From', border: OutlineInputBorder()),
                  child: Text(fmtDate(_frozenOn),
                      style: KText.bodyMd.copyWith(color: c.onSurface)),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: InkWell(
                onTap: _pickResume,
                child: InputDecorator(
                  decoration: const InputDecoration(
                      labelText: 'Resume Date', border: OutlineInputBorder()),
                  child: Text(fmtDate(_resumeDate),
                      style: KText.bodyMd.copyWith(color: c.onSurface)),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _freeze,
              style: FilledButton.styleFrom(backgroundColor: TW.blue600),
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Freeze Membership'),
            ),
          ),
        ],
      ),
    );
  }
}
