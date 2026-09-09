import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

const _planTypes = ['All', 'Gym', 'Personal Training', 'Group Class', 'Day Pass', 'Add-on'];

const _typeColor = {
  'Gym': TW.violet600,
  'Personal Training': TW.blue600,
  'Group Class': TW.emerald600,
  'Day Pass': TW.amber600,
  'Add-on': TW.rose600,
};

class PlansScreen extends StatefulWidget {
  const PlansScreen({super.key});
  @override
  State<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends State<PlansScreen> {
  List<Map<String, dynamic>> _plans = [];
  bool _loading = true;
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    final gymId = context.read<AuthProvider>().gymId;
    if (mounted) setState(() => _loading = true);
    try {
      final res = await TenantDb.getCollection(gymId, 'plans');
      if (mounted) setState(() => _plans = res);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  String _normalizeType(String? t) =>
      (t ?? '').toLowerCase().replaceAll('-', ' ').replaceAll('_', ' ').trim();

  List<Map<String, dynamic>> get _filtered {
    final sorted = [..._plans]..sort((a, b) {
        final aActive = (a['isActive'] != false) ? 0 : 1;
        final bActive = (b['isActive'] != false) ? 0 : 1;
        if (aActive != bActive) return aActive.compareTo(bActive);
        return (a['name'] as String? ?? '').compareTo(b['name'] as String? ?? '');
      });
    if (_tab == 0) return sorted;
    final t = _normalizeType(_planTypes[_tab]);
    return sorted.where((p) => _normalizeType(p['type'] as String?) == t).toList();
  }

  void _showForm([Map<String, dynamic>? plan]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PlanForm(
        plan: plan,
        gymId: context.read<AuthProvider>().gymId ?? '',
        onSaved: _fetch,
      ),
    );
  }

  Future<void> _duplicate(Map<String, dynamic> plan) async {
    final gymId = context.read<AuthProvider>().gymId ?? '';
    final copy = Map<String, dynamic>.from(plan)
      ..remove('id')
      ..['name'] = 'Copy of ${plan['name']}';
    await TenantDb.createDocument(gymId, 'plans', copy);
    _fetch();
  }

  Future<void> _delete(Map<String, dynamic> plan) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Plan'),
        content: Text('Delete "${plan['name']}"? This cannot be undone.'),
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
      await TenantDb.deleteDocument(context.read<AuthProvider>().gymId ?? '', 'plans', plan['id']);
      _fetch();
    }
  }

  Future<void> _toggleActive(Map<String, dynamic> plan) async {
    final gymId = context.read<AuthProvider>().gymId ?? '';
    final current = plan['isActive'] != false;
    await TenantDb.updateDocument(gymId, 'plans', plan['id'] as String, {'isActive': !current});
    _fetch();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final filtered = _filtered;
    final totalActive = _plans.where((p) => p['isActive'] != false).length;
    final totalInactive = _plans.length - totalActive;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        leading: IconButton(
          icon: Sym(MSym.arrowBack, size: 20, color: c.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Plans', style: KText.h3.copyWith(color: c.onSurface)),
        actions: [
          IconButton(
            icon: Sym(MSym.add, color: c.primary),
            onPressed: () => _showForm(),
            tooltip: 'Add plan',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetch,
        child: CustomScrollView(
          slivers: [
            // Summary stats
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                child: Row(children: [
                  _StatChip(label: 'Total', count: _plans.length, color: c.primary),
                  const SizedBox(width: 8),
                  _StatChip(label: 'Active', count: totalActive, color: TW.emerald600),
                  const SizedBox(width: 8),
                  _StatChip(label: 'Inactive', count: totalInactive, color: TW.slate400),
                ]),
              ),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 44,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _planTypes.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, i) => FilterChip(
                    label: Text(_planTypes[i]),
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
                  icon: MSym.loyalty,
                  message: _tab == 0 ? 'No plans yet' : 'No ${_planTypes[_tab]} plans',
                  action: _tab == 0
                      ? TextButton.icon(
                          onPressed: () => _showForm(),
                          icon: const Icon(Icons.add),
                          label: const Text('Add Plan'),
                        )
                      : null,
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => _PlanCard(
                      plan: filtered[i],
                      onEdit: () => _showForm(filtered[i]),
                      onDelete: () => _delete(filtered[i]),
                      onDuplicate: () => _duplicate(filtered[i]),
                      onToggleActive: () => _toggleActive(filtered[i]),
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

class _PlanCard extends StatelessWidget {
  final Map<String, dynamic> plan;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onDuplicate;
  final VoidCallback onToggleActive;
  const _PlanCard({required this.plan, required this.onEdit, required this.onDelete, required this.onDuplicate, required this.onToggleActive});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final type = plan['type'] as String? ?? 'Gym';
    final color = _typeColor[type] ?? TW.violet600;
    final isActive = plan['isActive'] != false;
    final price = asNum(plan['price']);
    final duration = asNum(plan['durationMonths']);
    final sessions = asNum(plan['sessions']);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: KCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Sym(MSym.loyalty, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(plan['name'] ?? '',
                            style: KText.bodyLg.copyWith(color: c.onSurface, fontWeight: FontWeight.w600)),
                      ),
                      Pill(type, bg: color.withValues(alpha: 0.1), fg: color),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      Text(rupees(price),
                          style: KText.bodyMd.copyWith(color: c.primary, fontWeight: FontWeight.w700)),
                      if (duration > 0)
                        Text('· ${duration.toInt()} month${duration > 1 ? 's' : ''}',
                            style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                      if (sessions > 0)
                        Text('· ${sessions.toInt()} sessions',
                            style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                      Pill(
                        isActive ? 'Active' : 'Inactive',
                        bg: isActive ? TW.emerald500.withValues(alpha: 0.1) : TW.slate200,
                        fg: isActive ? TW.emerald600 : TW.slate500,
                        dot: true,
                      ),
                    ],
                  ),
                  if ((plan['description'] ?? '').isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(plan['description'],
                          style: KText.bodyMd.copyWith(color: c.onSurfaceVariant),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                    ),
                  if ((plan['features'] as List?)?.isNotEmpty == true)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: (plan['features'] as List).take(3).map((f) => Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('· ', style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
                            Expanded(child: Text(f.toString(), style: TextStyle(color: c.onSurfaceVariant, fontSize: 12))),
                          ],
                        )).toList(),
                      ),
                    ),
                ],
              ),
            ),
            PopupMenuButton<String>(
              icon: Sym(MSym.expandMore, size: 18, color: c.onSurfaceVariant),
              onSelected: (v) {
                if (v == 'edit') onEdit();
                if (v == 'duplicate') onDuplicate();
                if (v == 'toggle') onToggleActive();
                if (v == 'delete') onDelete();
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'edit', child: Text('Edit')),
                const PopupMenuItem(value: 'duplicate', child: Text('Duplicate')),
                PopupMenuItem(
                    value: 'toggle',
                    child: Text(isActive ? 'Deactivate' : 'Activate',
                        style: TextStyle(color: isActive ? TW.amber600 : TW.emerald600))),
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

class _StatChip extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  const _StatChip({required this.label, required this.count, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(children: [
        Text('$count', style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 18, fontFamily: 'PlusJakartaSans')),
        Text(label, style: const TextStyle(color: TW.slate500, fontSize: 11, fontFamily: 'PlusJakartaSans')),
      ]),
    );
  }
}

class _PlanForm extends StatefulWidget {
  final Map<String, dynamic>? plan;
  final String gymId;
  final VoidCallback onSaved;
  const _PlanForm({this.plan, required this.gymId, required this.onSaved});

  @override
  State<_PlanForm> createState() => _PlanFormState();
}

class _PlanFormState extends State<_PlanForm> {
  final _nameCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _joiningFeeCtrl = TextEditingController();
  final _gstCtrl = TextEditingController();
  final _durationCtrl = TextEditingController();
  final _sessionsCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _featureCtrl = TextEditingController();
  List<String> _features = [];
  String _type = 'Gym';
  bool _isActive = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final p = widget.plan;
    if (p != null) {
      _nameCtrl.text = p['name'] ?? '';
      _priceCtrl.text = _nz(p['price']);
      _joiningFeeCtrl.text = _nz(p['joiningFee']);
      _gstCtrl.text = _nz(p['gstPercent']);
      _durationCtrl.text = _nz(p['durationMonths']);
      _sessionsCtrl.text = _nz(p['sessions']);
      _descCtrl.text = p['description'] ?? '';
      _type = p['type'] ?? 'Gym';
      _isActive = p['isActive'] != false;
      _features = List<String>.from((p['features'] as List?) ?? []);
    }
  }

  String _nz(dynamic v) {
    final n = asNum(v);
    return n == 0 ? '' : n.toString();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _priceCtrl.dispose();
    _joiningFeeCtrl.dispose();
    _gstCtrl.dispose();
    _durationCtrl.dispose();
    _sessionsCtrl.dispose();
    _descCtrl.dispose();
    _featureCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);
    final data = {
      'name': _nameCtrl.text.trim(),
      'type': _type,
      'price': num.tryParse(_priceCtrl.text) ?? 0,
      'joiningFee': num.tryParse(_joiningFeeCtrl.text) ?? 0,
      'gstPercent': num.tryParse(_gstCtrl.text) ?? 0,
      'durationMonths': num.tryParse(_durationCtrl.text) ?? 0,
      'sessions': num.tryParse(_sessionsCtrl.text) ?? 0,
      'description': _descCtrl.text.trim(),
      'features': _features,
      'isActive': _isActive,
    };
    try {
      if (widget.plan != null) {
        await TenantDb.updateDocument(widget.gymId, 'plans', widget.plan!['id'], data);
      } else {
        await TenantDb.createDocument(widget.gymId, 'plans', data);
      }
      if (mounted) Navigator.pop(context);
      widget.onSaved();
    } catch (_) {}
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isEdit = widget.plan != null;

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
                Text(isEdit ? 'Edit Plan' : 'Add Plan',
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
              decoration: const InputDecoration(labelText: 'Plan Name *', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _type,
              decoration: const InputDecoration(labelText: 'Type', border: OutlineInputBorder()),
              items: _planTypes
                  .skip(1)
                  .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                  .toList(),
              onChanged: (v) => setState(() => _type = v!),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _priceCtrl,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Price (₹)', border: OutlineInputBorder()),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _durationCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: 'Duration (months)', border: OutlineInputBorder()),
                ),
              ),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _joiningFeeCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: 'Joining Fee (₹)', border: OutlineInputBorder()),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _gstCtrl,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'GST %', border: OutlineInputBorder()),
                ),
              ),
            ]),
            const SizedBox(height: 12),
            TextField(
              controller: _sessionsCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                  labelText: 'Sessions (PT / Group Class)', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descCtrl,
              maxLines: 2,
              decoration:
                  const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            Text('Plan Features', style: TextStyle(fontSize: 13, color: context.c.onSurfaceVariant)),
            const SizedBox(height: 8),
            if (_features.isNotEmpty)
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _features.map((f) => Chip(
                  label: Text(f, style: const TextStyle(fontSize: 12)),
                  deleteIcon: const Icon(Icons.close, size: 14),
                  onDeleted: () => setState(() => _features.remove(f)),
                  padding: EdgeInsets.zero,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                )).toList(),
              ),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _featureCtrl,
                  decoration: const InputDecoration(
                    hintText: 'Add a feature (e.g. Locker access)',
                    border: OutlineInputBorder(),
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                  onSubmitted: (v) {
                    final f = v.trim();
                    if (f.isNotEmpty) {
                      setState(() { _features.add(f); _featureCtrl.clear(); });
                    }
                  },
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: Sym(MSym.add, size: 20, color: context.c.primary),
                onPressed: () {
                  final f = _featureCtrl.text.trim();
                  if (f.isNotEmpty) setState(() { _features.add(f); _featureCtrl.clear(); });
                },
              ),
            ]),
            const SizedBox(height: 4),
            SwitchListTile(
              value: _isActive,
              onChanged: (v) => setState(() => _isActive = v),
              title: const Text('Active'),
              contentPadding: EdgeInsets.zero,
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(isEdit ? 'Save Changes' : 'Add Plan'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
