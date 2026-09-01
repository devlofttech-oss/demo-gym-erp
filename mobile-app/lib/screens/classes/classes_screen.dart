import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/whatsapp_sheet.dart';

const _classTypes = ['All', 'Zumba', 'Yoga', 'Dance', 'HIIT', 'Kids Dance', 'Gym', 'Other'];
const _daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

class ClassesScreen extends StatefulWidget {
  const ClassesScreen({super.key});
  @override
  State<ClassesScreen> createState() => _ClassesScreenState();
}

class _ClassesScreenState extends State<ClassesScreen> {
  List<Map<String, dynamic>> _classes = [];
  List<Map<String, dynamic>> _staff = [];
  bool _loading = true;
  int _tab = 0;
  String _search = '';
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
    if (mounted) setState(() => _loading = true);
    try {
      final res = await Future.wait([
        TenantDb.getCollection(gymId, 'classes'),
        TenantDb.getCollection(gymId, 'staff'),
      ]);
      if (mounted) setState(() { _classes = res[0]; _staff = res[1]; });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _filtered {
    var list = _classes;
    if (_tab > 0) {
      final type = _classTypes[_tab];
      list = list.where((c) {
        final types = (c['type'] as List?)?.cast<String>() ?? [];
        return types.contains(type);
      }).toList();
    }
    if (_search.isNotEmpty) {
      final term = _search.toLowerCase();
      list = list.where((c) =>
          ((c['name'] as String?)?.toLowerCase().contains(term) ?? false) ||
          ((c['trainerName'] as String?)?.toLowerCase().contains(term) ?? false)).toList();
    }
    return list;
  }

  void _showForm([Map<String, dynamic>? cls]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ClassForm(
        cls: cls,
        gymId: context.read<AuthProvider>().gymId ?? '',
        staff: _staff,
        onSaved: _fetch,
      ),
    );
  }

  Future<void> _delete(Map<String, dynamic> cls) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Class'),
        content: Text('Delete "${cls['name']}"?'),
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
      await TenantDb.deleteDocument(context.read<AuthProvider>().gymId ?? '', 'classes', cls['id']);
      _fetch();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final filtered = _filtered;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        leading: IconButton(
          icon: Sym(MSym.arrowBack, size: 20, color: c.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Classes', style: KText.h3.copyWith(color: c.onSurface)),
        actions: [
          IconButton(
            icon: Sym(MSym.add, color: c.primary),
            onPressed: () => _showForm(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetch,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: TextField(
                  controller: _searchCtrl,
                  decoration: InputDecoration(
                    hintText: 'Search classes…',
                    prefixIcon: Sym(MSym.search, size: 20, color: c.onSurfaceVariant),
                    isDense: true,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  onChanged: (v) => setState(() => _search = v),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 44,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _classTypes.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) => FilterChip(
                    label: Text(_classTypes[i]),
                    selected: _tab == i,
                    onSelected: (_) => setState(() => _tab = i),
                    showCheckmark: false,
                  ),
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 8)),
            if (_loading)
              const SliverFillRemaining(child: KLoading())
            else if (filtered.isEmpty)
              SliverFillRemaining(
                child: KEmpty(
                  icon: MSym.groups,
                  message: _search.isNotEmpty ? 'No classes found' : 'No classes yet',
                  action: _search.isEmpty
                      ? TextButton.icon(
                          onPressed: () => _showForm(),
                          icon: const Icon(Icons.add),
                          label: const Text('Add Class'),
                        )
                      : null,
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => _ClassCard(
                      cls: filtered[i],
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ClassDetailScreen(
                            cls: filtered[i],
                            gymId: context.read<AuthProvider>().gymId ?? '',
                          ),
                        ),
                      ).then((_) => _fetch()),
                      onEdit: () => _showForm(filtered[i]),
                      onDelete: () => _delete(filtered[i]),
                    ),
                    childCount: filtered.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ClassCard extends StatelessWidget {
  final Map<String, dynamic> cls;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _ClassCard(
      {required this.cls, required this.onTap, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final types = (cls['type'] as List?)?.cast<String>() ?? [];
    final schedule = (cls['schedule'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final enrolled = (cls['enrolledMemberIds'] as List?)?.length ?? 0;
    final capacity = asNum(cls['capacity']).toInt();

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: KCard(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: TW.pink600.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Sym(MSym.groups, color: TW.pink600, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(cls['name'] ?? '',
                          style: KText.bodyLg.copyWith(
                              color: c.onSurface, fontWeight: FontWeight.w600)),
                      if ((cls['trainerName'] ?? '').isNotEmpty)
                        Text(cls['trainerName'],
                            style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
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
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: [
                for (final t in types)
                  Pill(t, bg: TW.pink600.withValues(alpha: 0.08), fg: TW.pink600),
              ],
            ),
            if (schedule.isNotEmpty) ...[
              const SizedBox(height: 6),
              for (final slot in schedule.take(3))
                Text('${slot['day']} ${slot['startTime']}–${slot['endTime']}',
                    style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
            ],
            if (capacity > 0) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Sym(MSym.group, size: 16, color: c.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text('$enrolled / $capacity',
                      style: KText.bodyMd.copyWith(color: c.onSurface)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: capacity > 0 ? (enrolled / capacity).clamp(0.0, 1.0) : 0,
                        backgroundColor: TW.slate200,
                        valueColor: AlwaysStoppedAnimation(
                            enrolled >= capacity ? TW.rose600 : TW.emerald600),
                        minHeight: 6,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Class Detail ─────────────────────────────────────────────────────────────

class ClassDetailScreen extends StatefulWidget {
  final Map<String, dynamic> cls;
  final String gymId;
  const ClassDetailScreen({super.key, required this.cls, required this.gymId});
  @override
  State<ClassDetailScreen> createState() => _ClassDetailScreenState();
}

class _ClassDetailScreenState extends State<ClassDetailScreen> {
  late Map<String, dynamic> _cls;
  List<Map<String, dynamic>> _members = [];
  List<Map<String, dynamic>> _allMembers = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _cls = widget.cls;
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    try {
      final res = await Future.wait([
        TenantDb.getDocument(widget.gymId, 'classes', _cls['id']),
        TenantDb.getCollection(widget.gymId, 'members'),
      ]);
      final cls = res[0] as Map<String, dynamic>?;
      if (cls != null && mounted) setState(() => _cls = cls);
      final allM = res[1] as List<Map<String, dynamic>>;
      final enrolledIds = (_cls['enrolledMemberIds'] as List?)?.cast<String>() ?? [];
      if (mounted) {
        setState(() {
          _allMembers = allM;
          _members = allM.where((m) => enrolledIds.contains(m['id'])).toList();
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _toggleEnroll(String memberId, bool enroll) async {
    final enrolledIds = List<String>.from(
        (_cls['enrolledMemberIds'] as List?)?.cast<String>() ?? []);
    if (enroll) {
      enrolledIds.add(memberId);
    } else {
      enrolledIds.remove(memberId);
    }
    await TenantDb.updateDocument(widget.gymId, 'classes', _cls['id'], {
      'enrolledMemberIds': enrolledIds,
    });
    _load();
  }

  void _showEnrollPicker() {
    final enrolledIds = (_cls['enrolledMemberIds'] as List?)?.cast<String>() ?? [];
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _MemberPicker(
        allMembers: _allMembers,
        enrolledIds: enrolledIds,
        onToggle: _toggleEnroll,
      ),
    );
  }

  void _whatsAppAll() {
    if (_members.isEmpty) return;
    showWhatsAppSheet(
      context,
      phone: _members.first['phone'] ?? '',
      defaultMessage:
          'Hi, this is a reminder about your ${_cls['name']} class. Please be on time!',
      recipientLabel: '${_members.length} enrolled members',
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final schedule = (_cls['schedule'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final types = (_cls['type'] as List?)?.cast<String>() ?? [];
    final capacity = asNum(_cls['capacity']).toInt();
    final enrolled = _members.length;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        leading: IconButton(
          icon: Sym(MSym.arrowBack, size: 20, color: c.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(_cls['name'] ?? 'Class', style: KText.h3.copyWith(color: c.onSurface)),
        actions: [
          if (_members.isNotEmpty)
            IconButton(
              icon: Sym(MSym.chat, color: TW.whatsapp),
              onPressed: _whatsAppAll,
              tooltip: 'WhatsApp enrolled',
            ),
          IconButton(
            icon: Sym(MSym.personAdd, color: c.primary),
            onPressed: _showEnrollPicker,
            tooltip: 'Manage enrolment',
          ),
        ],
      ),
      body: _loading
          ? const KLoading()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                KCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (types.isNotEmpty)
                        Wrap(
                          spacing: 6,
                          children: types
                              .map((t) =>
                                  Pill(t, bg: TW.pink600.withValues(alpha: 0.1), fg: TW.pink600))
                              .toList(),
                        ),
                      if ((c.onSurface != Colors.transparent) && types.isNotEmpty)
                        const SizedBox(height: 8),
                      if (((_cls['trainerName'] ?? '') as String).isNotEmpty)
                        _InfoRow(MSym.badge, 'Trainer', _cls['trainerName']),
                      if (capacity > 0)
                        _InfoRow(MSym.group, 'Capacity', '$enrolled / $capacity enrolled'),
                      if ((_cls['description'] ?? '').isNotEmpty)
                        _InfoRow(MSym.info, 'Description', _cls['description']),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                if (schedule.isNotEmpty) ...[
                  Text('Schedule', style: KText.labelCaps.copyWith(color: c.onSurfaceVariant)),
                  const SizedBox(height: 8),
                  KCard(
                    child: Column(
                      children: schedule
                          .map((slot) => Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Row(
                                  children: [
                                    Sym(MSym.schedule, size: 16, color: c.primary),
                                    const SizedBox(width: 8),
                                    Text('${slot['day']}',
                                        style: KText.bodyMd.copyWith(
                                            color: c.onSurface, fontWeight: FontWeight.w600)),
                                    const SizedBox(width: 8),
                                    Text('${slot['startTime']} – ${slot['endTime']}',
                                        style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                                  ],
                                ),
                              ))
                          .toList(),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                Text('Enrolled Members ($enrolled)',
                    style: KText.labelCaps.copyWith(color: c.onSurfaceVariant)),
                const SizedBox(height: 8),
                if (_members.isEmpty)
                  KEmpty(
                    icon: MSym.group,
                    message: 'No members enrolled',
                    action: TextButton.icon(
                      onPressed: _showEnrollPicker,
                      icon: const Icon(Icons.add),
                      label: const Text('Add Members'),
                    ),
                  )
                else
                  for (final m in _members)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: KCard(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            InitialAvatar(name: m['name'] ?? '', size: 36, bg: c.primaryContainer, fg: c.primary),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(m['name'] ?? '',
                                      style: KText.bodyMd.copyWith(
                                          color: c.onSurface, fontWeight: FontWeight.w600)),
                                  Text(m['phone'] ?? '',
                                      style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                                ],
                              ),
                            ),
                            IconButton(
                              icon: Sym(MSym.personOff, size: 20, color: TW.rose600),
                              onPressed: () => _toggleEnroll(m['id'], false),
                            ),
                          ],
                        ),
                      ),
                    ),
              ],
            ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Sym(icon, size: 16, color: c.onSurfaceVariant),
          const SizedBox(width: 8),
          Text('$label: ', style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
          Expanded(child: Text(value, style: KText.bodyMd.copyWith(color: c.onSurface))),
        ],
      ),
    );
  }
}

class _MemberPicker extends StatefulWidget {
  final List<Map<String, dynamic>> allMembers;
  final List<String> enrolledIds;
  final Future<void> Function(String memberId, bool enroll) onToggle;
  const _MemberPicker(
      {required this.allMembers, required this.enrolledIds, required this.onToggle});

  @override
  State<_MemberPicker> createState() => _MemberPickerState();
}

class _MemberPickerState extends State<_MemberPicker> {
  late List<String> _enrolled;
  String _search = '';
  final _ctrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _enrolled = List.from(widget.enrolledIds);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final filtered = widget.allMembers
        .where((m) => _search.isEmpty ||
            ((m['name'] as String?)?.toLowerCase().contains(_search.toLowerCase()) ?? false))
        .toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 8),
          Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                  color: TW.slate200, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Text('Manage Enrolment', style: KText.h3.copyWith(color: c.onSurface)),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Sym(MSym.close, size: 20, color: c.onSurfaceVariant),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _ctrl,
              decoration: InputDecoration(
                hintText: 'Search members…',
                prefixIcon: Sym(MSym.search, size: 18, color: c.onSurfaceVariant),
                isDense: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: filtered.length,
              itemBuilder: (_, i) {
                final m = filtered[i];
                final isEnrolled = _enrolled.contains(m['id']);
                return ListTile(
                  leading: InitialAvatar(name: m['name'] ?? '', size: 36, bg: c.primaryContainer, fg: c.primary),
                  title: Text(m['name'] ?? '',
                      style: KText.bodyMd.copyWith(color: c.onSurface, fontWeight: FontWeight.w600)),
                  subtitle: Text(m['phone'] ?? '',
                      style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                  trailing: Switch(
                    value: isEnrolled,
                    onChanged: (v) async {
                      await widget.onToggle(m['id'], v);
                      setState(() {
                        if (v) {
                          _enrolled.add(m['id']);
                        } else {
                          _enrolled.remove(m['id']);
                        }
                      });
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Add/Edit Form ─────────────────────────────────────────────────────────────

class _ClassForm extends StatefulWidget {
  final Map<String, dynamic>? cls;
  final String gymId;
  final List<Map<String, dynamic>> staff;
  final VoidCallback onSaved;
  const _ClassForm({this.cls, required this.gymId, required this.staff, required this.onSaved});

  @override
  State<_ClassForm> createState() => _ClassFormState();
}

class _ClassFormState extends State<_ClassForm> {
  final _nameCtrl = TextEditingController();
  final _capacityCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  List<String> _selectedTypes = [];
  String? _trainerId;
  String _trainerName = '';
  List<Map<String, String>> _schedule = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final cls = widget.cls;
    if (cls != null) {
      _nameCtrl.text = cls['name'] ?? '';
      _capacityCtrl.text = asNum(cls['capacity']) == 0 ? '' : asNum(cls['capacity']).toString();
      _descCtrl.text = cls['description'] ?? '';
      _selectedTypes = (cls['type'] as List?)?.cast<String>() ?? [];
      _trainerId = cls['trainerId'] as String?;
      _trainerName = cls['trainerName'] ?? '';
      _schedule = ((cls['schedule'] as List?) ?? [])
          .map((s) => Map<String, String>.from(s as Map))
          .toList();
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _capacityCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _addScheduleSlot() async {
    String day = 'Monday';
    TimeOfDay start = const TimeOfDay(hour: 9, minute: 0);
    TimeOfDay end = const TimeOfDay(hour: 10, minute: 0);

    final pickedStart = await showTimePicker(context: context, initialTime: start);
    if (pickedStart == null || !mounted) return;
    start = pickedStart;

    final pickedEnd = await showTimePicker(context: context, initialTime: end);
    if (pickedEnd == null || !mounted) return;
    end = pickedEnd;

    if (!mounted) return;
    await showDialog(
      context: context,
      builder: (dialogCtx) {
        String d = day;
        return AlertDialog(
          title: const Text('Select Day'),
          content: StatefulBuilder(
            builder: (_, ss) => DropdownButton<String>(
              value: d,
              isExpanded: true,
              items: _daysOfWeek.map((dw) => DropdownMenuItem(value: dw, child: Text(dw))).toList(),
              onChanged: (v) => ss(() => d = v!),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogCtx), child: const Text('Cancel')),
            FilledButton(
              onPressed: () {
                day = d;
                Navigator.pop(dialogCtx);
              },
              child: const Text('Add'),
            ),
          ],
        );
      },
    );

    setState(() {
      _schedule.add({
        'day': day,
        'startTime': start.format(context),
        'endTime': end.format(context),
      });
    });
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);
    final data = {
      'name': _nameCtrl.text.trim(),
      'type': _selectedTypes,
      'trainerId': _trainerId ?? '',
      'trainerName': _trainerName,
      'capacity': int.tryParse(_capacityCtrl.text) ?? 0,
      'description': _descCtrl.text.trim(),
      'schedule': _schedule,
    };
    try {
      if (widget.cls != null) {
        await TenantDb.updateDocument(widget.gymId, 'classes', widget.cls!['id'], data);
      } else {
        data['enrolledMemberIds'] = [];
        await TenantDb.createDocument(widget.gymId, 'classes', data);
      }
      if (mounted) Navigator.pop(context);
      widget.onSaved();
    } catch (_) {}
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isEdit = widget.cls != null;

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
                Text(isEdit ? 'Edit Class' : 'Add Class',
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
              decoration:
                  const InputDecoration(labelText: 'Class Name *', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            Text('Type', style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: _classTypes.skip(1).map((t) {
                final sel = _selectedTypes.contains(t);
                return FilterChip(
                  label: Text(t),
                  selected: sel,
                  onSelected: (v) => setState(() {
                    if (v) {
                      _selectedTypes.add(t);
                    } else {
                      _selectedTypes.remove(t);
                    }
                  }),
                  showCheckmark: true,
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
            if (widget.staff.isNotEmpty)
              DropdownButtonFormField<String>(
                value: _trainerId,
                decoration:
                    const InputDecoration(labelText: 'Trainer', border: OutlineInputBorder()),
                items: [
                  const DropdownMenuItem(value: null, child: Text('No trainer')),
                  ...widget.staff.map((s) => DropdownMenuItem(
                      value: s['id'] as String, child: Text(s['name'] ?? ''))),
                ],
                onChanged: (v) {
                  setState(() {
                    _trainerId = v;
                    _trainerName = v == null
                        ? ''
                        : (widget.staff.firstWhere((s) => s['id'] == v,
                                orElse: () => {})['name'] ??
                            '');
                  });
                },
              ),
            const SizedBox(height: 12),
            TextField(
              controller: _capacityCtrl,
              keyboardType: TextInputType.number,
              decoration:
                  const InputDecoration(labelText: 'Capacity', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descCtrl,
              maxLines: 2,
              decoration:
                  const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Text('Schedule', style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                const Spacer(),
                TextButton.icon(
                  onPressed: _addScheduleSlot,
                  icon: Sym(MSym.add, size: 16, color: c.primary),
                  label: const Text('Add slot'),
                ),
              ],
            ),
            for (var i = 0; i < _schedule.length; i++)
              ListTile(
                dense: true,
                leading: Sym(MSym.schedule, size: 18, color: c.primary),
                title: Text(
                    '${_schedule[i]['day']} ${_schedule[i]['startTime']}–${_schedule[i]['endTime']}'),
                trailing: IconButton(
                  icon: Sym(MSym.close, size: 16, color: TW.rose600),
                  onPressed: () => setState(() => _schedule.removeAt(i)),
                ),
                contentPadding: EdgeInsets.zero,
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
                    : Text(isEdit ? 'Save Changes' : 'Add Class'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
