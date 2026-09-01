import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

const _dietGoals = ['All', 'weight-loss', 'muscle-gain', 'maintenance', 'medical'];
const _dietGoalLabels = {
  'weight-loss': 'Weight Loss',
  'muscle-gain': 'Muscle Gain',
  'maintenance': 'Maintenance',
  'medical': 'Medical',
};

class DietScreen extends StatefulWidget {
  const DietScreen({super.key});
  @override
  State<DietScreen> createState() => _DietScreenState();
}

class _DietScreenState extends State<DietScreen> {
  List<Map<String, dynamic>> _plans = [];
  List<Map<String, dynamic>> _members = [];
  bool _loading = true;
  int _goalFilter = 0;
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
        TenantDb.getCollection(gymId, 'dietPlans'),
        TenantDb.getCollection(gymId, 'members'),
      ]);
      if (mounted) setState(() { _plans = res[0]; _members = res[1]; });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _filtered {
    var list = _plans;
    if (_goalFilter > 0) {
      final goal = _dietGoals[_goalFilter];
      list = list.where((p) => p['goal'] == goal).toList();
    }
    if (_search.isNotEmpty) {
      final term = _search.toLowerCase();
      list = list
          .where((p) =>
              ((p['name'] as String?)?.toLowerCase().contains(term) ?? false) ||
              ((p['assignedMemberName'] as String?)?.toLowerCase().contains(term) ?? false))
          .toList();
    }
    return list;
  }

  void _showForm([Map<String, dynamic>? plan]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _DietForm(
        plan: plan,
        gymId: context.read<AuthProvider>().gymId ?? '',
        members: _members,
        onSaved: _fetch,
      ),
    );
  }

  Future<void> _delete(Map<String, dynamic> plan) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Diet Plan'),
        content: Text('Delete "${plan['name']}"?'),
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
      await TenantDb.deleteDocument(context.read<AuthProvider>().gymId ?? '', 'dietPlans', plan['id']);
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
        title: Text('Diet Plans', style: KText.h3.copyWith(color: c.onSurface)),
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
                    hintText: 'Search diet plans…',
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
                  itemCount: _dietGoals.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) => FilterChip(
                    label: Text(i == 0
                        ? 'All'
                        : (_dietGoalLabels[_dietGoals[i]] ?? _dietGoals[i])),
                    selected: _goalFilter == i,
                    onSelected: (_) => setState(() => _goalFilter = i),
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
                  icon: MSym.restaurant,
                  message: 'No diet plans yet',
                  action: TextButton.icon(
                    onPressed: () => _showForm(),
                    icon: const Icon(Icons.add),
                    label: const Text('Add Plan'),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => _DietCard(
                      plan: filtered[i],
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

Color _goalColor(String? goal) {
  switch (goal) {
    case 'weight-loss':
      return TW.rose600;
    case 'muscle-gain':
      return TW.blue600;
    case 'maintenance':
      return TW.emerald600;
    case 'medical':
      return TW.violet600;
    default:
      return TW.slate500;
  }
}

class _DietCard extends StatelessWidget {
  final Map<String, dynamic> plan;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _DietCard({required this.plan, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final goal = plan['goal'] as String?;
    final color = _goalColor(goal);
    final meals = (plan['meals'] as List?) ?? [];

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
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Sym(MSym.restaurant, color: color, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(plan['name'] ?? '',
                          style: KText.bodyLg.copyWith(
                              color: c.onSurface, fontWeight: FontWeight.w600)),
                      if ((plan['assignedMemberName'] ?? '').isNotEmpty)
                        Text(plan['assignedMemberName'],
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
            if (goal != null)
              Pill(_dietGoalLabels[goal] ?? goal, bg: color.withValues(alpha: 0.08), fg: color),
            const SizedBox(height: 8),
            Row(
              children: [
                if (asNum(plan['caloriesPerDay']) > 0) ...[
                  Sym(MSym.restaurant, size: 14, color: c.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text('${asNum(plan['caloriesPerDay']).toStringAsFixed(0)} kcal/day',
                      style: KText.bodyMd.copyWith(color: c.onSurface)),
                  const SizedBox(width: 12),
                ],
                Sym(MSym.schedule, size: 14, color: c.onSurfaceVariant),
                const SizedBox(width: 4),
                Text('${meals.length} meals',
                    style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
              ],
            ),
            if (asNum(plan['protein']) > 0 ||
                asNum(plan['carbs']) > 0 ||
                asNum(plan['fat']) > 0) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  _MacroPill('P: ${asNum(plan['protein']).toStringAsFixed(0)}g', TW.blue600),
                  const SizedBox(width: 6),
                  _MacroPill('C: ${asNum(plan['carbs']).toStringAsFixed(0)}g', TW.amber600),
                  const SizedBox(width: 6),
                  _MacroPill('F: ${asNum(plan['fat']).toStringAsFixed(0)}g', TW.rose600),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MacroPill extends StatelessWidget {
  final String label;
  final Color color;
  const _MacroPill(this.label, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(label, style: KText.bodyMd.copyWith(color: color, fontSize: 11)),
    );
  }
}

// ── Diet Form ─────────────────────────────────────────────────────────────────

class _DietForm extends StatefulWidget {
  final Map<String, dynamic>? plan;
  final String gymId;
  final List<Map<String, dynamic>> members;
  final VoidCallback onSaved;
  const _DietForm({this.plan, required this.gymId, required this.members, required this.onSaved});

  @override
  State<_DietForm> createState() => _DietFormState();
}

class _DietFormState extends State<_DietForm> {
  final _nameCtrl = TextEditingController();
  final _caloriesCtrl = TextEditingController();
  final _proteinCtrl = TextEditingController();
  final _carbsCtrl = TextEditingController();
  final _fatCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _goal = 'maintenance';
  String? _memberId;
  String _memberName = '';
  List<_MealEntry> _meals = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final plan = widget.plan;
    if (plan != null) {
      _nameCtrl.text = plan['name'] ?? '';
      _caloriesCtrl.text =
          asNum(plan['caloriesPerDay']) == 0 ? '' : asNum(plan['caloriesPerDay']).toString();
      _proteinCtrl.text = asNum(plan['protein']) == 0 ? '' : asNum(plan['protein']).toString();
      _carbsCtrl.text = asNum(plan['carbs']) == 0 ? '' : asNum(plan['carbs']).toString();
      _fatCtrl.text = asNum(plan['fat']) == 0 ? '' : asNum(plan['fat']).toString();
      _descCtrl.text = plan['description'] ?? '';
      _goal = plan['goal'] ?? 'maintenance';
      _memberId = plan['assignedMemberId'] as String?;
      _memberName = plan['assignedMemberName'] ?? '';
      final meals = (plan['meals'] as List?) ?? [];
      _meals = meals.map((m) {
        final mp = Map<String, dynamic>.from(m as Map);
        return _MealEntry(
          nameCtrl: TextEditingController(text: mp['mealName'] ?? ''),
          descCtrl: TextEditingController(text: mp['description'] ?? ''),
          calCtrl: TextEditingController(
              text: asNum(mp['calories']) == 0 ? '' : asNum(mp['calories']).toString()),
        );
      }).toList();
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _caloriesCtrl.dispose();
    _proteinCtrl.dispose();
    _carbsCtrl.dispose();
    _fatCtrl.dispose();
    _descCtrl.dispose();
    for (final m in _meals) {
      m.nameCtrl.dispose();
      m.descCtrl.dispose();
      m.calCtrl.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);
    final mealsData = _meals.map((m) => {
          'mealName': m.nameCtrl.text.trim(),
          'description': m.descCtrl.text.trim(),
          'calories': double.tryParse(m.calCtrl.text) ?? 0,
        }).toList();
    final data = {
      'name': _nameCtrl.text.trim(),
      'goal': _goal,
      'caloriesPerDay': double.tryParse(_caloriesCtrl.text) ?? 0,
      'protein': double.tryParse(_proteinCtrl.text) ?? 0,
      'carbs': double.tryParse(_carbsCtrl.text) ?? 0,
      'fat': double.tryParse(_fatCtrl.text) ?? 0,
      'description': _descCtrl.text.trim(),
      'assignedMemberId': _memberId ?? '',
      'assignedMemberName': _memberName,
      'meals': mealsData,
    };
    try {
      if (widget.plan != null) {
        await TenantDb.updateDocument(widget.gymId, 'dietPlans', widget.plan!['id'], data);
      } else {
        await TenantDb.createDocument(widget.gymId, 'dietPlans', data);
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
                Text(isEdit ? 'Edit Diet Plan' : 'Add Diet Plan',
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
              decoration: const InputDecoration(
                  labelText: 'Plan Name *', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _goal,
              decoration: const InputDecoration(labelText: 'Goal', border: OutlineInputBorder()),
              items: _dietGoals.skip(1).map((g) => DropdownMenuItem(
                  value: g, child: Text(_dietGoalLabels[g] ?? g))).toList(),
              onChanged: (v) => setState(() => _goal = v ?? 'maintenance'),
            ),
            const SizedBox(height: 12),
            if (widget.members.isNotEmpty)
              DropdownButtonFormField<String>(
                value: _memberId,
                decoration: const InputDecoration(
                    labelText: 'Assign to Member', border: OutlineInputBorder()),
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
            TextField(
              controller: _caloriesCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                  labelText: 'Calories per Day (kcal)', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _proteinCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'Protein (g)', border: OutlineInputBorder()),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _carbsCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'Carbs (g)', border: OutlineInputBorder()),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _fatCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'Fat (g)', border: OutlineInputBorder()),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descCtrl,
              maxLines: 2,
              decoration: const InputDecoration(
                  labelText: 'Description', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Text('Meals', style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                const Spacer(),
                TextButton.icon(
                  onPressed: () => setState(() => _meals.add(_MealEntry(
                    nameCtrl: TextEditingController(),
                    descCtrl: TextEditingController(),
                    calCtrl: TextEditingController(),
                  ))),
                  icon: Sym(MSym.add, size: 16, color: c.primary),
                  label: const Text('Add Meal'),
                ),
              ],
            ),
            for (var i = 0; i < _meals.length; i++) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: c.surface,
                  border: Border.all(color: c.outline.withValues(alpha: 0.5)),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Text('Meal ${i + 1}',
                            style: KText.bodyMd.copyWith(
                                color: c.onSurface, fontWeight: FontWeight.w600)),
                        const Spacer(),
                        IconButton(
                          icon: Sym(MSym.close, size: 16, color: TW.rose600),
                          onPressed: () => setState(() => _meals.removeAt(i)),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _meals[i].nameCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Meal Name', border: OutlineInputBorder(), isDense: true),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _meals[i].descCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Description', border: OutlineInputBorder(), isDense: true),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _meals[i].calCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                          labelText: 'Calories (kcal)',
                          border: OutlineInputBorder(),
                          isDense: true),
                    ),
                  ],
                ),
              ),
            ],
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
                    : Text(isEdit ? 'Save Changes' : 'Add Plan'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MealEntry {
  final TextEditingController nameCtrl;
  final TextEditingController descCtrl;
  final TextEditingController calCtrl;
  _MealEntry(
      {required this.nameCtrl, required this.descCtrl, required this.calCtrl});
}
