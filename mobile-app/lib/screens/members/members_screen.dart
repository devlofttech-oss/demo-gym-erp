import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/whatsapp_sheet.dart';
import '../../widgets/whatsapp_api_sheet.dart';
import 'add_member_screen.dart';
import 'member_detail_screen.dart';

const _pageSize = 25;

class MembersScreen extends StatefulWidget {
  const MembersScreen({super.key});
  @override
  State<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends State<MembersScreen> {
  List<Map<String, dynamic>> _members = [];
  bool _loading = true;
  String _search = '';
  String _status = 'All';
  String _category = 'All';
  int _page = 1;

  // absentees
  List<Map<String, dynamic>> _absentees = [];
  bool _absLoading = false;
  bool _absLoaded = false;

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
      final data = await TenantDb.getCollection(gymId, 'members');
      if (mounted) setState(() => _members = data);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _fetchAbsentees() async {
    setState(() => _absLoading = true);
    final gymId = context.read<AuthProvider>().gymId;
    try {
      final now = DateTime.now();
      final fiveDaysAgo = now.subtract(const Duration(days: 4)).toIso8601String().split('T').first;
      final thirtyDaysAgo = now.subtract(const Duration(days: 30)).toIso8601String().split('T').first;
      final recent = await TenantDb.getCollection(gymId, 'attendance',
          conditions: [Cond('date', '>=', thirtyDaysAgo)]);
      final lastVisit = <String, String>{};
      for (final a in recent) {
        final mid = a['memberId'] as String?;
        final d = a['date'] as String?;
        if (mid == null || d == null) continue;
        if (!lastVisit.containsKey(mid) || d.compareTo(lastVisit[mid]!) > 0) lastVisit[mid] = d;
      }
      final list = _members.where((m) {
        final days = daysUntilExpiry(m['expiryDate'] as String?);
        final isActive = days == null || days >= 0;
        final lv = lastVisit[m['id']];
        final hasRecent = lv != null && lv.compareTo(fiveDaysAgo) >= 0;
        return isActive && !hasRecent;
      }).map((m) => {...m, 'lastVisit': lastVisit[m['id']]}).toList();
      setState(() {
        _absentees = list;
        _absLoaded = true;
      });
    } catch (_) {}
    if (mounted) setState(() => _absLoading = false);
  }

  bool _matchesCategory(Map<String, dynamic> m, String cat) {
    if (cat == 'All') return true;
    final plan = (m['planName'] as String?) ?? '';
    if (cat == 'Group Classes') return plan.startsWith('Group Classes') || plan.startsWith('Kids Dance');
    return plan.startsWith(cat);
  }

  List<Map<String, dynamic>> get _filtered {
    final term = _search.toLowerCase();
    return _members.where((m) {
      final matchSearch = term.isEmpty ||
          ((m['name'] as String?)?.toLowerCase().contains(term) ?? false) ||
          ((m['phone'] as String?)?.contains(term) ?? false);
      final days = daysUntilExpiry(m['expiryDate'] as String?);
      final isFrozen = m['status'] == 'Frozen';
      var matchStatus = true;
      if (_status == 'Active') matchStatus = !isFrozen && (days == null || days >= 0);
      else if (_status == 'Expired') matchStatus = !isFrozen && days != null && days < 0;
      else if (_status == 'Expiring') matchStatus = !isFrozen && days != null && days >= 0 && days <= 7;
      else if (_status == 'Frozen') matchStatus = isFrozen;
      else if (_status == 'Balance Due') matchStatus = asNum(m['balanceFees']) > 0;
      return matchSearch && matchStatus && _matchesCategory(m, _category);
    }).toList();
  }

  int get _expiringCount => _members.where((m) {
        final d = daysUntilExpiry(m['expiryDate'] as String?);
        return d != null && d >= 0 && d <= 7;
      }).length;

  void _resetPage() => _page = 1;

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final totalPages = (filtered.length / _pageSize).ceil();
    final paginated = filtered.skip((_page - 1) * _pageSize).take(_pageSize).toList();

    return RefreshIndicator(
      onRefresh: () async {
        setState(() => _loading = true);
        _absLoaded = false;
        await _fetch();
      },
      child: ListView(
        padding: const EdgeInsets.all(KSpace.gutter),
        children: [
          PageHeader('Members', 'Manage your gym members, plans, and statuses.',
              trailing: _addBtn()),
          const SizedBox(height: 16),
          if (_expiringCount > 0) ...[_expiringBanner(), const SizedBox(height: 12)],
          _categoryTabs(),
          const SizedBox(height: 12),
          _searchBar(),
          const SizedBox(height: 12),
          _statusFilters(),
          const SizedBox(height: 16),
          if (_status == 'Absentees')
            _absenteesView()
          else if (_loading)
            const KLoading()
          else if (paginated.isEmpty)
            KEmpty(
              icon: MSym.groupOff,
              message: 'No members found',
              action: _addFirstBtn(),
            )
          else ...[
            ...paginated.map(_memberCard),
            if (totalPages > 1) _pagination(totalPages, filtered.length),
          ],
        ],
      ),
    );
  }

  Widget _addBtn() {
    final c = context.c;
    return Material(
      color: c.primary,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () async {
          await Navigator.push(context, MaterialPageRoute(builder: (_) => const AddMemberScreen()));
          setState(() => _loading = true);
          _fetch();
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Sym(MSym.personAdd, size: 18, color: c.onPrimary),
            const SizedBox(width: 6),
            Text('New', style: TextStyle(color: c.onPrimary, fontWeight: FontWeight.w500)),
          ]),
        ),
      ),
    );
  }

  Widget _addFirstBtn() {
    final c = context.c;
    return FilledButton(
      style: FilledButton.styleFrom(backgroundColor: c.primary, foregroundColor: c.onPrimary),
      onPressed: () async {
        await Navigator.push(context, MaterialPageRoute(builder: (_) => const AddMemberScreen()));
        setState(() => _loading = true);
        _fetch();
      },
      child: const Text('Add First Member'),
    );
  }

  Widget _expiringBanner() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: TW.amber50, borderRadius: BorderRadius.circular(12), border: Border.all(color: TW.amber200)),
      child: Row(children: [
        const Sym(MSym.notificationImportant, size: 24, color: TW.amber500),
        const SizedBox(width: 12),
        Expanded(
          child: Text('$_expiringCount member${_expiringCount > 1 ? 's' : ''} expiring within 7 days — send a WhatsApp reminder with the Remind button in their row.',
              style: const TextStyle(color: TW.amber800, fontSize: 13, fontWeight: FontWeight.w500)),
        ),
      ]),
    );
  }

  Widget _categoryTabs() {
    const cats = ['All', 'Gym', 'Zumba', 'Group Classes'];
    final meta = {
      'Gym': (MSym.fitnessCenter, TW.violet600, TW.violet600),
      'Zumba': (MSym.musicNote, TW.pink600, TW.pink500),
      'Group Classes': (MSym.groups, TW.amber600, TW.amber500),
    };
    final c = context.c;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: cats.map((cat) {
          final active = _category == cat;
          final count = cat == 'All' ? _members.length : _members.where((m) => _matchesCategory(m, cat)).length;
          final m = meta[cat];
          final activeBg = cat == 'All' ? c.primary : (m?.$3 ?? c.primary);
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Material(
              color: active ? activeBg : c.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(12),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => setState(() { _category = cat; _resetPage(); }),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: active ? null : Border.all(color: c.outlineVariant.withValues(alpha: 0.3)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (m != null) ...[Sym(m.$1, size: 16, color: active ? Colors.white : m.$2), const SizedBox(width: 6)],
                    Text(cat, style: TextStyle(color: active ? Colors.white : c.onSurfaceVariant, fontWeight: FontWeight.w500, fontSize: 14)),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: active ? Colors.white24 : c.surfaceContainer, borderRadius: BorderRadius.circular(999)),
                      child: Text('$count', style: TextStyle(color: active ? Colors.white : c.onSurfaceVariant, fontSize: 11, fontWeight: FontWeight.w600)),
                    ),
                  ]),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _searchBar() {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: c.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.outlineVariant.withValues(alpha: 0.3)),
      ),
      child: Row(children: [
        Sym(MSym.search, size: 20, color: c.onSurfaceVariant),
        const SizedBox(width: 8),
        Expanded(
          child: TextField(
            controller: _searchCtrl,
            onChanged: (v) => setState(() { _search = v; _resetPage(); }),
            style: TextStyle(color: c.onSurface, fontSize: 14),
            decoration: InputDecoration(
              isDense: true,
              border: InputBorder.none,
              hintText: 'Search by name or phone...',
              hintStyle: TextStyle(color: c.onSurfaceVariant),
            ),
          ),
        ),
        if (_search.isNotEmpty)
          GestureDetector(
            onTap: () { _searchCtrl.clear(); setState(() { _search = ''; _resetPage(); }); },
            child: Sym(MSym.close, size: 16, color: c.onSurfaceVariant),
          ),
      ]),
    );
  }

  Widget _statusFilters() {
    const filters = [
      ('All', 'All'), ('Active', 'Active'), ('Expiring', 'Expiring Soon'),
      ('Expired', 'Expired'), ('Frozen', 'Frozen'), ('Balance Due', 'Balance Due'), ('Absentees', 'Absentees'),
    ];
    final c = context.c;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: filters.map((f) {
          final active = _status == f.$1;
          Color activeBg = c.primary;
          if (f.$1 == 'Expiring') activeBg = TW.amber500;
          if (f.$1 == 'Balance Due') activeBg = TW.rose600;
          if (f.$1 == 'Absentees') activeBg = TW.orange500;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Material(
              color: active ? activeBg : c.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(8),
              child: InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: () {
                  setState(() { _status = f.$1; _resetPage(); });
                  if (f.$1 == 'Absentees' && !_absLoaded && _members.isNotEmpty) _fetchAbsentees();
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: active ? null : Border.all(color: c.outlineVariant.withValues(alpha: 0.3)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (f.$1 == 'Absentees') ...[Sym(MSym.personOff, size: 14, color: active ? Colors.white : c.onSurfaceVariant), const SizedBox(width: 4)],
                    Text(f.$2, style: TextStyle(color: active ? Colors.white : c.onSurfaceVariant, fontWeight: FontWeight.w500, fontSize: 14)),
                  ]),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _memberCard(Map<String, dynamic> m) {
    final c = context.c;
    final days = daysUntilExpiry(m['expiryDate'] as String?);
    final isExpiring = days != null && days >= 0 && days <= 7;
    final isExpired = days != null && days < 0;
    final isFrozen = m['status'] == 'Frozen';
    final phone = m['phone'] as String?;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: KCard(
        onTap: () async {
          await Navigator.push(context, MaterialPageRoute(builder: (_) => MemberDetailScreen(member: m)));
          setState(() => _loading = true);
          _fetch();
        },
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              InitialAvatar(name: m['name'] as String?, size: 40, bg: c.primaryContainer, fg: c.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text((m['name'] as String?) ?? '—', style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w600)),
                  Text(phone ?? '', style: TextStyle(color: c.onSurfaceVariant, fontSize: 13)),
                ]),
              ),
              _statusBadge(isFrozen ? 'Frozen' : isExpired ? 'Expired' : 'Active'),
            ]),
            const SizedBox(height: 12),
            _kv('Plan', (m['planName'] as String?) ?? 'N/A'),
            const SizedBox(height: 4),
            Row(children: [
              SizedBox(width: 70, child: Text('Expiry', style: TextStyle(color: c.onSurfaceVariant, fontSize: 14))),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text((m['expiryDate'] as String?) ?? 'N/A',
                      style: TextStyle(fontWeight: FontWeight.w500, color: isExpired ? TW.rose600 : isExpiring ? TW.amber600 : c.onSurface)),
                  if (isExpiring) Text('⚠ ${days}d left', style: const TextStyle(color: TW.amber500, fontSize: 12)),
                  if (isExpired) Text('${days.abs()}d ago', style: const TextStyle(color: TW.rose500, fontSize: 12)),
                ]),
              ),
            ]),
            if (isExpiring && phone != null && phone.isNotEmpty) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: c.primary, foregroundColor: c.onPrimary),
                  onPressed: () {
                    final auth = context.read<AuthProvider>();
                    showWhatsAppApiSheet(context,
                        gymId: auth.gymId ?? '',
                        gymName: auth.gymName,
                        type: 'renewal',
                        recipients: [m],
                        recipientLabel: '${m['name']} · $phone');
                  },
                  icon: const Sym(MSym.sms, size: 14),
                  label: const Text('Remind'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _kv(String k, String v) {
    final c = context.c;
    return Row(children: [
      SizedBox(width: 70, child: Text(k, style: TextStyle(color: c.onSurfaceVariant, fontSize: 14))),
      Expanded(child: Text(v, style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w500), overflow: TextOverflow.ellipsis)),
    ]);
  }

  Widget _statusBadge(String status) {
    if (status == 'Frozen') return const Pill('Frozen', fg: TW.blue600, bg: TW.blue50, icon: MSym.acUnit);
    if (status == 'Active') return const Pill('Active', fg: TW.emerald600, bg: TW.emerald50, dot: true);
    return const Pill('Expired', fg: TW.rose600, bg: TW.rose50, dot: true);
  }

  Widget _absenteesView() {
    final c = context.c;
    if (_absLoading) return const KLoading(label: 'Checking attendance records…');
    if (_absentees.isEmpty) {
      return const KEmpty(icon: MSym.sentimentSatisfied, iconColor: TW.emerald500, message: 'No absentees — everyone has visited in the last 5 days!');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          const Sym(MSym.personOff, size: 20, color: TW.orange500),
          const SizedBox(width: 8),
          Expanded(
            child: Text('${_absentees.length} active member${_absentees.length != 1 ? 's' : ''} absent for 5+ days',
                style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w600)),
          ),
        ]),
        const SizedBox(height: 12),
        ..._absentees.map((m) {
          final lv = m['lastVisit'] as String?;
          final since = lv != null ? DateTime.now().difference(DateTime.parse(lv)).inDays : null;
          final phone = m['phone'] as String?;
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: KCard(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  InitialAvatar(name: m['name'] as String?, size: 44, bg: TW.orange100, fg: TW.orange600),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text((m['name'] as String?) ?? '—', style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w600)),
                    Text(phone ?? '', style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
                  ])),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  Sym(MSym.eventBusy, size: 14, color: c.onSurfaceVariant),
                  const SizedBox(width: 6),
                  Expanded(child: Text(since != null ? 'Last visit: $since day${since != 1 ? 's' : ''} ago ($lv)' : 'No visit record found',
                      style: TextStyle(color: c.onSurfaceVariant, fontSize: 12))),
                ]),
                const SizedBox(height: 6),
                Row(children: [
                  Sym(MSym.cardMembership, size: 14, color: c.onSurfaceVariant),
                  const SizedBox(width: 6),
                  Text((m['planName'] as String?) ?? 'No plan', style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
                ]),
                if (phone != null && phone.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(backgroundColor: TW.orange500, foregroundColor: Colors.white),
                      onPressed: () => showWhatsAppSheet(context,
                          phone: phone,
                          recipientLabel: '${m['name']} · $phone',
                          defaultMessage: 'Dear ${m['name']},\n\nWe noticed your absence from recent sessions. Regular attendance helps you reach your fitness goals. See you soon! 💪'),
                      icon: const Sym(MSym.chat, size: 14, fill: true),
                      label: const Text('Send Reminder'),
                    ),
                  ),
                ],
              ]),
            ),
          );
        }),
      ],
    );
  }

  Widget _pagination(int totalPages, int total) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            onPressed: _page > 1 ? () => setState(() => _page--) : null,
            icon: Sym(MSym.chevronLeft, size: 20, color: c.onSurfaceVariant),
          ),
          Text('Page $_page of $totalPages', style: TextStyle(color: c.onSurfaceVariant, fontSize: 13)),
          IconButton(
            onPressed: _page < totalPages ? () => setState(() => _page++) : null,
            icon: Sym(MSym.chevronRight, size: 20, color: c.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}
