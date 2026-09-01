import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

const _sessionStatuses = ['All', 'Scheduled', 'Completed', 'Cancelled'];

class PTScreen extends StatefulWidget {
  const PTScreen({super.key});
  @override
  State<PTScreen> createState() => _PTScreenState();
}

class _PTScreenState extends State<PTScreen> with SingleTickerProviderStateMixin {
  late final TabController _tab;
  List<Map<String, dynamic>> _packages = [];
  List<Map<String, dynamic>> _sessions = [];
  List<Map<String, dynamic>> _staff = [];
  List<Map<String, dynamic>> _members = [];
  bool _loading = true;
  int _sessionStatusFilter = 0;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _fetch();
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    final gymId = context.read<AuthProvider>().gymId;
    if (mounted) setState(() => _loading = true);
    try {
      final res = await Future.wait([
        TenantDb.getCollection(gymId, 'ptPackages'),
        TenantDb.getCollection(gymId, 'ptSessions'),
        TenantDb.getCollection(gymId, 'staff'),
        TenantDb.getCollection(gymId, 'members'),
      ]);
      if (mounted) {
        setState(() {
          _packages = res[0]..sort((a, b) => (b['createdAt'] ?? '').compareTo(a['createdAt'] ?? ''));
          _sessions = res[1]..sort((a, b) => (b['date'] ?? '').compareTo(a['date'] ?? ''));
          _staff = res[2];
          _members = res[3];
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _filteredSessions {
    if (_sessionStatusFilter == 0) return _sessions;
    final status = _sessionStatuses[_sessionStatusFilter];
    return _sessions.where((s) => s['status'] == status).toList();
  }

  // Stats
  int get _totalPackages => _packages.length;
  int get _activeClients {
    final ids = <String>{};
    for (final p in _packages) {
      if ((p['memberId'] ?? '').isNotEmpty) ids.add(p['memberId'] as String);
    }
    return ids.length;
  }
  int get _sessionsThisMonth {
    final now = DateTime.now();
    final prefix = '${now.year}-${now.month.toString().padLeft(2, '0')}';
    return _sessions.where((s) => (s['date'] ?? '').startsWith(prefix)).length;
  }
  double get _totalRevenue =>
      _packages.fold(0.0, (sum, p) => sum + asNum(p['price']));

  void _showPackageForm([Map<String, dynamic>? pkg]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PackageForm(
        pkg: pkg,
        gymId: context.read<AuthProvider>().gymId ?? '',
        staff: _staff,
        members: _members,
        onSaved: _fetch,
      ),
    );
  }

  void _showSessionForm([Map<String, dynamic>? session]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SessionForm(
        session: session,
        gymId: context.read<AuthProvider>().gymId ?? '',
        packages: _packages,
        staff: _staff,
        onSaved: _fetch,
      ),
    );
  }

  Future<void> _deletePackage(Map<String, dynamic> pkg) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Package'),
        content: Text('Delete "${pkg['name']}"?'),
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
    if (ok == true && mounted) {
      await TenantDb.deleteDocument(context.read<AuthProvider>().gymId ?? '', 'ptPackages', pkg['id']);
      _fetch();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        leading: IconButton(
          icon: Sym(MSym.arrowBack, size: 20, color: c.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Personal Training', style: KText.h3.copyWith(color: c.onSurface)),
        actions: [
          IconButton(
            icon: Sym(MSym.add, color: c.primary),
            onPressed: () => _tab.index == 0 ? _showPackageForm() : _showSessionForm(),
          ),
        ],
        bottom: TabBar(
          controller: _tab,
          onTap: (_) => setState(() {}),
          tabs: const [Tab(text: 'Packages'), Tab(text: 'Sessions')],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _fetch,
        child: _loading
            ? const KLoading()
            : TabBarView(
                controller: _tab,
                children: [
                  _packagesTab(c),
                  _sessionsTab(c),
                ],
              ),
      ),
    );
  }

  Widget _packagesTab(AppColors c) {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                _StatCard('Packages', '$_totalPackages', TW.orange600),
                const SizedBox(width: 8),
                _StatCard('Clients', '$_activeClients', TW.blue600),
                const SizedBox(width: 8),
                _StatCard('Revenue', '₹${grouped(_totalRevenue)}', TW.emerald600),
              ],
            ),
          ),
        ),
        if (_packages.isEmpty)
          SliverFillRemaining(
            child: KEmpty(
              icon: MSym.fitnessCenter,
              message: 'No PT packages yet',
              action: TextButton.icon(
                onPressed: () => _showPackageForm(),
                icon: const Icon(Icons.add),
                label: const Text('Add Package'),
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, i) => _PackageCard(
                  pkg: _packages[i],
                  onEdit: () => _showPackageForm(_packages[i]),
                  onDelete: () => _deletePackage(_packages[i]),
                  onLogSession: () => _showSessionForm(),
                ),
                childCount: _packages.length,
              ),
            ),
          ),
      ],
    );
  }

  Widget _sessionsTab(AppColors c) {
    final filtered = _filteredSessions;
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(
              children: [
                _StatCard('This Month', '$_sessionsThisMonth', TW.orange600),
                const SizedBox(width: 8),
                _StatCard('Total', '${_sessions.length}', TW.blue600),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              itemCount: _sessionStatuses.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) => FilterChip(
                label: Text(_sessionStatuses[i]),
                selected: _sessionStatusFilter == i,
                onSelected: (_) => setState(() => _sessionStatusFilter = i),
                showCheckmark: false,
              ),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 8)),
        if (filtered.isEmpty)
          SliverFillRemaining(
            child: KEmpty(icon: MSym.schedule, message: 'No sessions found'),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, i) => _SessionCard(
                  session: filtered[i],
                  onEdit: () => _showSessionForm(filtered[i]),
                  onDelete: () async {
                    await TenantDb.deleteDocument(
                        context.read<AuthProvider>().gymId ?? '', 'ptSessions', filtered[i]['id']);
                    _fetch();
                  },
                ),
                childCount: filtered.length,
              ),
            ),
          ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatCard(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Text(value,
                style: KText.h3.copyWith(color: color, fontWeight: FontWeight.w700),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
            const SizedBox(height: 2),
            Text(label,
                style: KText.bodyMd.copyWith(color: c.onSurfaceVariant),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}

class _PackageCard extends StatelessWidget {
  final Map<String, dynamic> pkg;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onLogSession;
  const _PackageCard(
      {required this.pkg,
      required this.onEdit,
      required this.onDelete,
      required this.onLogSession});

  Color get _statusColor {
    final remaining = asNum(pkg['sessionsIncluded']).toInt() -
        asNum(pkg['sessionsCompleted']).toInt();
    if (remaining <= 0) return TW.rose600;
    if (remaining <= 3) return TW.amber600;
    return TW.emerald600;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final sessionsIncluded = asNum(pkg['sessionsIncluded']).toInt();
    final sessionsCompleted = asNum(pkg['sessionsCompleted']).toInt();
    final remaining = sessionsIncluded - sessionsCompleted;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: KCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: TW.orange600.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Sym(MSym.fitnessCenter, color: TW.orange600, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(pkg['name'] ?? '',
                          style: KText.bodyLg.copyWith(
                              color: c.onSurface, fontWeight: FontWeight.w600)),
                      if ((pkg['memberName'] ?? '').isNotEmpty)
                        Text(pkg['memberName'],
                            style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  icon: Sym(MSym.expandMore, size: 18, color: c.onSurfaceVariant),
                  onSelected: (v) {
                    if (v == 'edit') onEdit();
                    if (v == 'delete') onDelete();
                    if (v == 'session') onLogSession();
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'session', child: Text('Log Session')),
                    const PopupMenuItem(value: 'edit', child: Text('Edit')),
                    const PopupMenuItem(
                        value: 'delete',
                        child: Text('Delete', style: TextStyle(color: TW.rose600))),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                if ((pkg['trainerName'] ?? '').isNotEmpty) ...[
                  Sym(MSym.badge, size: 14, color: c.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text(pkg['trainerName'],
                      style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                  const SizedBox(width: 12),
                ],
                Sym(MSym.payments, size: 14, color: c.onSurfaceVariant),
                const SizedBox(width: 4),
                Text('₹${grouped(asNum(pkg['price']))}',
                    style: KText.bodyMd.copyWith(color: c.onSurface, fontWeight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: sessionsIncluded > 0
                          ? (sessionsCompleted / sessionsIncluded).clamp(0.0, 1.0)
                          : 0,
                      backgroundColor: TW.slate200,
                      valueColor: AlwaysStoppedAnimation(_statusColor),
                      minHeight: 6,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text('$remaining left',
                    style: KText.bodyMd.copyWith(color: _statusColor, fontWeight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 2),
            Text('$sessionsCompleted / $sessionsIncluded sessions completed',
                style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  final Map<String, dynamic> session;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _SessionCard({required this.session, required this.onEdit, required this.onDelete});

  Color get _statusColor {
    switch (session['status']) {
      case 'Completed':
        return TW.emerald600;
      case 'Cancelled':
        return TW.rose600;
      default:
        return TW.blue600;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: KCard(
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(session['memberName'] ?? '',
                          style: KText.bodyMd.copyWith(
                              color: c.onSurface, fontWeight: FontWeight.w600)),
                      const SizedBox(width: 8),
                      Pill(
                        session['status'] ?? 'Scheduled',
                        bg: _statusColor.withValues(alpha: 0.1),
                        fg: _statusColor,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Sym(MSym.calendarToday, size: 14, color: c.onSurfaceVariant),
                      const SizedBox(width: 4),
                      Text(fmtDate(session['date'] ?? ''),
                          style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                      if ((session['time'] ?? '').isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Sym(MSym.schedule, size: 14, color: c.onSurfaceVariant),
                        const SizedBox(width: 4),
                        Text(session['time'],
                            style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                      ],
                    ],
                  ),
                  if ((session['trainerName'] ?? '').isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(session['trainerName'],
                        style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                  ],
                  if ((session['notes'] ?? '').isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(session['notes'],
                        style: KText.bodyMd.copyWith(color: c.onSurfaceVariant),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                  ],
                ],
              ),
            ),
            PopupMenuButton<String>(
              icon: Sym(MSym.expandMore, size: 18, color: c.onSurfaceVariant),
              onSelected: (v) {
                if (v == 'edit') onEdit();
                if (v == 'delete') onDelete();
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'edit', child: Text('Edit')),
                const PopupMenuItem(
                    value: 'delete',
                    child: Text('Delete', style: TextStyle(color: TW.rose600))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Package Form ──────────────────────────────────────────────────────────────

class _PackageForm extends StatefulWidget {
  final Map<String, dynamic>? pkg;
  final String gymId;
  final List<Map<String, dynamic>> staff;
  final List<Map<String, dynamic>> members;
  final VoidCallback onSaved;
  const _PackageForm(
      {this.pkg,
      required this.gymId,
      required this.staff,
      required this.members,
      required this.onSaved});

  @override
  State<_PackageForm> createState() => _PackageFormState();
}

class _PackageFormState extends State<_PackageForm> {
  final _nameCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _sessionsCtrl = TextEditingController();
  final _durationCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String? _trainerId;
  String _trainerName = '';
  String? _memberId;
  String _memberName = '';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final pkg = widget.pkg;
    if (pkg != null) {
      _nameCtrl.text = pkg['name'] ?? '';
      _priceCtrl.text = asNum(pkg['price']) == 0 ? '' : asNum(pkg['price']).toString();
      _sessionsCtrl.text = asNum(pkg['sessionsIncluded']) == 0
          ? ''
          : asNum(pkg['sessionsIncluded']).toInt().toString();
      _durationCtrl.text = asNum(pkg['durationMonths']) == 0
          ? ''
          : asNum(pkg['durationMonths']).toInt().toString();
      _descCtrl.text = pkg['description'] ?? '';
      _trainerId = pkg['trainerId'] as String?;
      _trainerName = pkg['trainerName'] ?? '';
      _memberId = pkg['memberId'] as String?;
      _memberName = pkg['memberName'] ?? '';
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _priceCtrl.dispose();
    _sessionsCtrl.dispose();
    _durationCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);
    final data = {
      'name': _nameCtrl.text.trim(),
      'price': double.tryParse(_priceCtrl.text) ?? 0,
      'sessionsIncluded': int.tryParse(_sessionsCtrl.text) ?? 0,
      'sessionsCompleted': widget.pkg?['sessionsCompleted'] ?? 0,
      'durationMonths': int.tryParse(_durationCtrl.text) ?? 0,
      'description': _descCtrl.text.trim(),
      'trainerId': _trainerId ?? '',
      'trainerName': _trainerName,
      'memberId': _memberId ?? '',
      'memberName': _memberName,
    };
    try {
      if (widget.pkg != null) {
        await TenantDb.updateDocument(widget.gymId, 'ptPackages', widget.pkg!['id'], data);
      } else {
        await TenantDb.createDocument(widget.gymId, 'ptPackages', data);
      }
      if (mounted) Navigator.pop(context);
      widget.onSaved();
    } catch (_) {}
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isEdit = widget.pkg != null;

    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(
          20, 12, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
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
                Text(isEdit ? 'Edit Package' : 'Add Package',
                    style: KText.h3.copyWith(color: c.onSurface)),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Sym(MSym.close, size: 20, color: c.onSurfaceVariant),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Package Name *', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            if (widget.members.isNotEmpty)
              DropdownButtonFormField<String>(
                value: _memberId,
                decoration: const InputDecoration(labelText: 'Member', border: OutlineInputBorder()),
                items: [
                  const DropdownMenuItem(value: null, child: Text('No member')),
                  ...widget.members.map((m) =>
                      DropdownMenuItem(value: m['id'] as String, child: Text(m['name'] ?? ''))),
                ],
                onChanged: (v) => setState(() {
                  _memberId = v;
                  _memberName = v == null
                      ? ''
                      : (widget.members.firstWhere((m) => m['id'] == v,
                              orElse: () => {})['name'] ??
                          '');
                }),
              ),
            const SizedBox(height: 12),
            if (widget.staff.isNotEmpty)
              DropdownButtonFormField<String>(
                value: _trainerId,
                decoration: const InputDecoration(labelText: 'Trainer', border: OutlineInputBorder()),
                items: [
                  const DropdownMenuItem(value: null, child: Text('No trainer')),
                  ...widget.staff.map((s) =>
                      DropdownMenuItem(value: s['id'] as String, child: Text(s['name'] ?? ''))),
                ],
                onChanged: (v) => setState(() {
                  _trainerId = v;
                  _trainerName = v == null
                      ? ''
                      : (widget.staff.firstWhere((s) => s['id'] == v,
                              orElse: () => {})['name'] ??
                          '');
                }),
              ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _priceCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'Price (₹)', border: OutlineInputBorder()),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _sessionsCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'Sessions', border: OutlineInputBorder()),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _durationCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                  labelText: 'Duration (months)', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descCtrl,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(isEdit ? 'Save Changes' : 'Add Package'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Session Form ──────────────────────────────────────────────────────────────

class _SessionForm extends StatefulWidget {
  final Map<String, dynamic>? session;
  final String gymId;
  final List<Map<String, dynamic>> packages;
  final List<Map<String, dynamic>> staff;
  final VoidCallback onSaved;
  const _SessionForm(
      {this.session,
      required this.gymId,
      required this.packages,
      required this.staff,
      required this.onSaved});

  @override
  State<_SessionForm> createState() => _SessionFormState();
}

class _SessionFormState extends State<_SessionForm> {
  final _notesCtrl = TextEditingController();
  final _timeCtrl = TextEditingController();
  String? _packageId;
  String _memberName = '';
  String? _trainerId;
  String _trainerName = '';
  String _status = 'Scheduled';
  DateTime _date = DateTime.now();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final s = widget.session;
    if (s != null) {
      _notesCtrl.text = s['notes'] ?? '';
      _timeCtrl.text = s['time'] ?? '';
      _packageId = s['packageId'] as String?;
      _memberName = s['memberName'] ?? '';
      _trainerId = s['trainerId'] as String?;
      _trainerName = s['trainerName'] ?? '';
      _status = s['status'] ?? 'Scheduled';
      if ((s['date'] ?? '').isNotEmpty) {
        _date = DateTime.tryParse(s['date']) ?? DateTime.now();
      }
    }
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    _timeCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(
        context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime(2030));
    if (d != null && mounted) setState(() => _date = d);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final data = {
      'packageId': _packageId ?? '',
      'memberName': _memberName,
      'trainerId': _trainerId ?? '',
      'trainerName': _trainerName,
      'date': _date.toIso8601String().substring(0, 10),
      'time': _timeCtrl.text.trim(),
      'status': _status,
      'notes': _notesCtrl.text.trim(),
    };
    try {
      if (widget.session != null) {
        await TenantDb.updateDocument(widget.gymId, 'ptSessions', widget.session!['id'], data);
        // If completing, increment sessionsCompleted on package
        if (_status == 'Completed' && widget.session!['status'] != 'Completed' && _packageId != null) {
          final pkgs = await TenantDb.getCollection(widget.gymId, 'ptPackages');
          final pkg = pkgs.firstWhere((p) => p['id'] == _packageId, orElse: () => {});
          if (pkg.isNotEmpty) {
            final completed = asNum(pkg['sessionsCompleted']).toInt() + 1;
            await TenantDb.updateDocument(
                widget.gymId, 'ptPackages', _packageId!, {'sessionsCompleted': completed});
          }
        }
      } else {
        await TenantDb.createDocument(widget.gymId, 'ptSessions', data);
        if (_status == 'Completed' && _packageId != null) {
          final pkgs = await TenantDb.getCollection(widget.gymId, 'ptPackages');
          final pkg = pkgs.firstWhere((p) => p['id'] == _packageId, orElse: () => {});
          if (pkg.isNotEmpty) {
            final completed = asNum(pkg['sessionsCompleted']).toInt() + 1;
            await TenantDb.updateDocument(
                widget.gymId, 'ptPackages', _packageId!, {'sessionsCompleted': completed});
          }
        }
      }
      if (mounted) Navigator.pop(context);
      widget.onSaved();
    } catch (_) {}
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isEdit = widget.session != null;

    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(
          20, 12, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
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
                Text(isEdit ? 'Edit Session' : 'Log Session',
                    style: KText.h3.copyWith(color: c.onSurface)),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Sym(MSym.close, size: 20, color: c.onSurfaceVariant),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (widget.packages.isNotEmpty)
              DropdownButtonFormField<String>(
                value: _packageId,
                decoration: const InputDecoration(labelText: 'Package', border: OutlineInputBorder()),
                items: [
                  const DropdownMenuItem(value: null, child: Text('No package')),
                  ...widget.packages.map((p) =>
                      DropdownMenuItem(value: p['id'] as String, child: Text(p['name'] ?? ''))),
                ],
                onChanged: (v) => setState(() {
                  _packageId = v;
                  if (v != null) {
                    final pkg = widget.packages.firstWhere((p) => p['id'] == v, orElse: () => {});
                    _memberName = pkg['memberName'] ?? '';
                    _trainerId = pkg['trainerId'] as String?;
                    _trainerName = pkg['trainerName'] ?? '';
                  }
                }),
              ),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: _pickDate,
              child: AbsorbPointer(
                child: TextField(
                  decoration: InputDecoration(
                    labelText: 'Date',
                    border: const OutlineInputBorder(),
                    suffixIcon: Sym(MSym.calendarToday, size: 18, color: c.onSurfaceVariant),
                  ),
                  controller: TextEditingController(
                      text: _date.toIso8601String().substring(0, 10)),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _timeCtrl,
              decoration: const InputDecoration(labelText: 'Time (e.g. 10:00 AM)', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _status,
              decoration: const InputDecoration(labelText: 'Status', border: OutlineInputBorder()),
              items: _sessionStatuses.skip(1).map((s) =>
                  DropdownMenuItem(value: s, child: Text(s))).toList(),
              onChanged: (v) => setState(() => _status = v ?? 'Scheduled'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notesCtrl,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Notes', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(isEdit ? 'Save Changes' : 'Log Session'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
