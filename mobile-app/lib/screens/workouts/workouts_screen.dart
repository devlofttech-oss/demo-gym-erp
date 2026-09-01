import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

const _workoutLevels = ['All', 'Beginner', 'Intermediate', 'Advanced'];
const _workoutGoals = [
  'Weight Loss',
  'Muscle Gain',
  'Endurance',
  'Flexibility',
  'General Fitness',
  'Strength',
];

class WorkoutsScreen extends StatefulWidget {
  const WorkoutsScreen({super.key});
  @override
  State<WorkoutsScreen> createState() => _WorkoutsScreenState();
}

class _WorkoutsScreenState extends State<WorkoutsScreen> {
  List<Map<String, dynamic>> _workouts = [];
  List<Map<String, dynamic>> _members = [];
  bool _loading = true;
  int _levelFilter = 0;
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
        TenantDb.getCollection(gymId, 'workouts'),
        TenantDb.getCollection(gymId, 'members'),
      ]);
      if (mounted) setState(() { _workouts = res[0]; _members = res[1]; });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _filtered {
    var list = _workouts;
    if (_levelFilter > 0) {
      final level = _workoutLevels[_levelFilter];
      list = list.where((w) => w['level'] == level).toList();
    }
    if (_search.isNotEmpty) {
      final term = _search.toLowerCase();
      list = list
          .where((w) =>
              ((w['name'] as String?)?.toLowerCase().contains(term) ?? false) ||
              ((w['assignedMemberName'] as String?)?.toLowerCase().contains(term) ?? false))
          .toList();
    }
    return list;
  }

  void _showForm([Map<String, dynamic>? workout]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _WorkoutForm(
        workout: workout,
        gymId: context.read<AuthProvider>().gymId ?? '',
        members: _members,
        onSaved: _fetch,
      ),
    );
  }

  Future<void> _delete(Map<String, dynamic> workout) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Workout'),
        content: Text('Delete "${workout['name']}"?'),
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
      await TenantDb.deleteDocument(context.read<AuthProvider>().gymId ?? '', 'workouts', workout['id']);
      _fetch();
    }
  }

  Color _levelColor(String? level) {
    switch (level) {
      case 'Beginner':
        return TW.emerald600;
      case 'Intermediate':
        return TW.amber600;
      case 'Advanced':
        return TW.rose600;
      default:
        return TW.slate500;
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
        title: Text('Workouts', style: KText.h3.copyWith(color: c.onSurface)),
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
                    hintText: 'Search workouts…',
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
                  itemCount: _workoutLevels.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) => FilterChip(
                    label: Text(_workoutLevels[i]),
                    selected: _levelFilter == i,
                    onSelected: (_) => setState(() => _levelFilter = i),
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
                  icon: MSym.exercise,
                  message: 'No workouts yet',
                  action: TextButton.icon(
                    onPressed: () => _showForm(),
                    icon: const Icon(Icons.add),
                    label: const Text('Add Workout'),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => _WorkoutCard(
                      workout: filtered[i],
                      levelColor: _levelColor(filtered[i]['level'] as String?),
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

class _WorkoutCard extends StatelessWidget {
  final Map<String, dynamic> workout;
  final Color levelColor;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _WorkoutCard(
      {required this.workout,
      required this.levelColor,
      required this.onEdit,
      required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final exercises = (workout['exercises'] as List?) ?? [];

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
                    color: TW.violet600.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Sym(MSym.exercise, color: TW.violet600, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(workout['name'] ?? '',
                          style: KText.bodyLg.copyWith(
                              color: c.onSurface, fontWeight: FontWeight.w600)),
                      if ((workout['assignedMemberName'] ?? '').isNotEmpty)
                        Text(workout['assignedMemberName'],
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
                if (workout['level'] != null)
                  Pill(workout['level'],
                      bg: levelColor.withValues(alpha: 0.08), fg: levelColor),
                if ((workout['goal'] ?? '').isNotEmpty)
                  Pill(workout['goal'],
                      bg: TW.violet600.withValues(alpha: 0.08), fg: TW.violet600),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                if (asNum(workout['durationMinutes']) > 0) ...[
                  Sym(MSym.schedule, size: 14, color: c.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text('${asNum(workout['durationMinutes']).toStringAsFixed(0)} min',
                      style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                  const SizedBox(width: 12),
                ],
                if (asNum(workout['daysPerWeek']) > 0) ...[
                  Sym(MSym.calendarMonth, size: 14, color: c.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text('${asNum(workout['daysPerWeek']).toStringAsFixed(0)}x/week',
                      style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                  const SizedBox(width: 12),
                ],
                Sym(MSym.fitnessCenter, size: 14, color: c.onSurfaceVariant),
                const SizedBox(width: 4),
                Text('${exercises.length} exercises',
                    style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Workout Form ──────────────────────────────────────────────────────────────

class _WorkoutForm extends StatefulWidget {
  final Map<String, dynamic>? workout;
  final String gymId;
  final List<Map<String, dynamic>> members;
  final VoidCallback onSaved;
  const _WorkoutForm(
      {this.workout, required this.gymId, required this.members, required this.onSaved});

  @override
  State<_WorkoutForm> createState() => _WorkoutFormState();
}

class _WorkoutFormState extends State<_WorkoutForm> {
  final _nameCtrl = TextEditingController();
  final _durationCtrl = TextEditingController();
  final _daysCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _level = 'Beginner';
  String _goal = 'General Fitness';
  String? _memberId;
  String _memberName = '';
  List<_ExerciseEntry> _exercises = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final w = widget.workout;
    if (w != null) {
      _nameCtrl.text = w['name'] ?? '';
      _durationCtrl.text =
          asNum(w['durationMinutes']) == 0 ? '' : asNum(w['durationMinutes']).toString();
      _daysCtrl.text =
          asNum(w['daysPerWeek']) == 0 ? '' : asNum(w['daysPerWeek']).toString();
      _descCtrl.text = w['description'] ?? '';
      _level = w['level'] ?? 'Beginner';
      _goal = w['goal'] ?? 'General Fitness';
      _memberId = w['assignedMemberId'] as String?;
      _memberName = w['assignedMemberName'] ?? '';
      final exs = (w['exercises'] as List?) ?? [];
      _exercises = exs.map((e) {
        final ep = Map<String, dynamic>.from(e as Map);
        return _ExerciseEntry(
          nameCtrl: TextEditingController(text: ep['name'] ?? ''),
          setsCtrl: TextEditingController(
              text: asNum(ep['sets']) == 0 ? '' : asNum(ep['sets']).toInt().toString()),
          repsCtrl: TextEditingController(
              text: asNum(ep['reps']) == 0 ? '' : asNum(ep['reps']).toInt().toString()),
          restCtrl: TextEditingController(
              text: asNum(ep['restSeconds']) == 0 ? '' : asNum(ep['restSeconds']).toInt().toString()),
          notesCtrl: TextEditingController(text: ep['notes'] ?? ''),
        );
      }).toList();
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _durationCtrl.dispose();
    _daysCtrl.dispose();
    _descCtrl.dispose();
    for (final e in _exercises) {
      e.nameCtrl.dispose();
      e.setsCtrl.dispose();
      e.repsCtrl.dispose();
      e.restCtrl.dispose();
      e.notesCtrl.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);
    final exercisesData = _exercises.map((e) => {
          'name': e.nameCtrl.text.trim(),
          'sets': int.tryParse(e.setsCtrl.text) ?? 0,
          'reps': int.tryParse(e.repsCtrl.text) ?? 0,
          'restSeconds': int.tryParse(e.restCtrl.text) ?? 0,
          'notes': e.notesCtrl.text.trim(),
        }).toList();
    final data = {
      'name': _nameCtrl.text.trim(),
      'level': _level,
      'goal': _goal,
      'durationMinutes': int.tryParse(_durationCtrl.text) ?? 0,
      'daysPerWeek': int.tryParse(_daysCtrl.text) ?? 0,
      'description': _descCtrl.text.trim(),
      'assignedMemberId': _memberId ?? '',
      'assignedMemberName': _memberName,
      'exercises': exercisesData,
    };
    try {
      if (widget.workout != null) {
        await TenantDb.updateDocument(widget.gymId, 'workouts', widget.workout!['id'], data);
      } else {
        await TenantDb.createDocument(widget.gymId, 'workouts', data);
      }
      if (mounted) Navigator.pop(context);
      widget.onSaved();
    } catch (_) {}
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isEdit = widget.workout != null;

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
                Text(isEdit ? 'Edit Workout' : 'Add Workout',
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
                  labelText: 'Workout Name *', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _level,
              decoration:
                  const InputDecoration(labelText: 'Level', border: OutlineInputBorder()),
              items: _workoutLevels.skip(1).map((l) =>
                  DropdownMenuItem(value: l, child: Text(l))).toList(),
              onChanged: (v) => setState(() => _level = v ?? 'Beginner'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _goal,
              decoration:
                  const InputDecoration(labelText: 'Goal', border: OutlineInputBorder()),
              items: _workoutGoals.map((g) =>
                  DropdownMenuItem(value: g, child: Text(g))).toList(),
              onChanged: (v) => setState(() => _goal = v ?? 'General Fitness'),
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
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _durationCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'Duration (min)', border: OutlineInputBorder()),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _daysCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'Days/week', border: OutlineInputBorder()),
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
                Text('Exercises', style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                const Spacer(),
                TextButton.icon(
                  onPressed: () => setState(() => _exercises.add(_ExerciseEntry(
                    nameCtrl: TextEditingController(),
                    setsCtrl: TextEditingController(),
                    repsCtrl: TextEditingController(),
                    restCtrl: TextEditingController(),
                    notesCtrl: TextEditingController(),
                  ))),
                  icon: Sym(MSym.add, size: 16, color: c.primary),
                  label: const Text('Add Exercise'),
                ),
              ],
            ),
            for (var i = 0; i < _exercises.length; i++) ...[
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
                        Text('Exercise ${i + 1}',
                            style: KText.bodyMd.copyWith(
                                color: c.onSurface, fontWeight: FontWeight.w600)),
                        const Spacer(),
                        IconButton(
                          icon: Sym(MSym.close, size: 16, color: TW.rose600),
                          onPressed: () => setState(() => _exercises.removeAt(i)),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _exercises[i].nameCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Exercise Name', border: OutlineInputBorder(), isDense: true),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _exercises[i].setsCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                                labelText: 'Sets', border: OutlineInputBorder(), isDense: true),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _exercises[i].repsCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                                labelText: 'Reps', border: OutlineInputBorder(), isDense: true),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _exercises[i].restCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                                labelText: 'Rest (s)', border: OutlineInputBorder(), isDense: true),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _exercises[i].notesCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Notes', border: OutlineInputBorder(), isDense: true),
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
                    : Text(isEdit ? 'Save Changes' : 'Add Workout'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExerciseEntry {
  final TextEditingController nameCtrl;
  final TextEditingController setsCtrl;
  final TextEditingController repsCtrl;
  final TextEditingController restCtrl;
  final TextEditingController notesCtrl;
  _ExerciseEntry({
    required this.nameCtrl,
    required this.setsCtrl,
    required this.repsCtrl,
    required this.restCtrl,
    required this.notesCtrl,
  });
}
