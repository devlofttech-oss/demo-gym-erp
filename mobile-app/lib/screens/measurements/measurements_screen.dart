import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

class MeasurementsScreen extends StatefulWidget {
  const MeasurementsScreen({super.key});
  @override
  State<MeasurementsScreen> createState() => _MeasurementsScreenState();
}

class _MeasurementsScreenState extends State<MeasurementsScreen> {
  List<Map<String, dynamic>> _members = [];
  List<Map<String, dynamic>> _measurements = [];
  Map<String, dynamic>? _selectedMember;
  bool _loadingMembers = true;
  bool _loadingMeasurements = false;
  String _search = '';
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchMembers();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchMembers() async {
    final gymId = context.read<AuthProvider>().gymId;
    if (mounted) setState(() => _loadingMembers = true);
    try {
      final res = await TenantDb.getCollection(gymId, 'members');
      if (mounted) setState(() => _members = res);
    } catch (_) {}
    if (mounted) setState(() => _loadingMembers = false);
  }

  Future<void> _fetchMeasurements(String memberId) async {
    final gymId = context.read<AuthProvider>().gymId;
    if (mounted) setState(() => _loadingMeasurements = true);
    try {
      final all = await TenantDb.getCollection(gymId, 'measurements');
      final filtered = all
          .where((m) => m['memberId'] == memberId)
          .toList()
        ..sort((a, b) => (a['date'] ?? '').compareTo(b['date'] ?? ''));
      if (mounted) setState(() => _measurements = filtered);
    } catch (_) {}
    if (mounted) setState(() => _loadingMeasurements = false);
  }

  List<Map<String, dynamic>> get _filteredMembers {
    if (_search.isEmpty) return _members;
    final term = _search.toLowerCase();
    return _members
        .where((m) => (m['name'] as String?)?.toLowerCase().contains(term) ?? false)
        .toList();
  }

  void _selectMember(Map<String, dynamic> member) {
    setState(() {
      _selectedMember = member;
      _measurements = [];
    });
    _fetchMeasurements(member['id']);
  }

  void _showForm([Map<String, dynamic>? measurement]) {
    if (_selectedMember == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _MeasurementForm(
        measurement: measurement,
        gymId: context.read<AuthProvider>().gymId ?? '',
        member: _selectedMember!,
        onSaved: () => _fetchMeasurements(_selectedMember!['id']),
      ),
    );
  }

  Future<void> _delete(Map<String, dynamic> m) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Measurement'),
        content: Text('Delete measurement from ${fmtDate(m['date'] ?? '')}?'),
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
      await TenantDb.deleteDocument(context.read<AuthProvider>().gymId ?? '', 'measurements', m['id']);
      _fetchMeasurements(_selectedMember!['id']);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    if (_selectedMember != null) {
      return _MemberMeasurementsView(
        member: _selectedMember!,
        measurements: _measurements,
        loading: _loadingMeasurements,
        onBack: () => setState(() { _selectedMember = null; _measurements = []; }),
        onAdd: () => _showForm(),
        onEdit: _showForm,
        onDelete: _delete,
      );
    }

    final filtered = _filteredMembers;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        leading: IconButton(
          icon: Sym(MSym.arrowBack, size: 20, color: c.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Measurements', style: KText.h3.copyWith(color: c.onSurface)),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search members…',
                prefixIcon: Sym(MSym.search, size: 20, color: c.onSurfaceVariant),
                isDense: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),
          Expanded(
            child: _loadingMembers
                ? const KLoading()
                : filtered.isEmpty
                    ? KEmpty(icon: MSym.group, message: 'No members found')
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: filtered.length,
                        itemBuilder: (_, i) {
                          final m = filtered[i];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: KCard(
                              onTap: () => _selectMember(m),
                              child: Row(
                                children: [
                                  InitialAvatar(name: m['name'] ?? '', size: 40, bg: c.primaryContainer, fg: c.primary),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(m['name'] ?? '',
                                            style: KText.bodyMd.copyWith(
                                                color: c.onSurface,
                                                fontWeight: FontWeight.w600)),
                                        Text(m['phone'] ?? '',
                                            style: KText.bodyMd
                                                .copyWith(color: c.onSurfaceVariant)),
                                      ],
                                    ),
                                  ),
                                  Sym(MSym.chevronRight, size: 20, color: c.onSurfaceVariant),
                                ],
                              ),
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

// ── Member Measurements View ──────────────────────────────────────────────────

class _MemberMeasurementsView extends StatelessWidget {
  final Map<String, dynamic> member;
  final List<Map<String, dynamic>> measurements;
  final bool loading;
  final VoidCallback onBack;
  final VoidCallback onAdd;
  final void Function(Map<String, dynamic>) onEdit;
  final void Function(Map<String, dynamic>) onDelete;

  const _MemberMeasurementsView({
    required this.member,
    required this.measurements,
    required this.loading,
    required this.onBack,
    required this.onAdd,
    required this.onEdit,
    required this.onDelete,
  });

  List<FlSpot> get _weightSpots {
    final data = measurements
        .where((m) => asNum(m['weight']) > 0)
        .toList();
    return List.generate(
        data.length, (i) => FlSpot(i.toDouble(), asNum(data[i]['weight']).toDouble()));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final latest = measurements.isNotEmpty ? measurements.last : null;
    final spots = _weightSpots;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        leading: IconButton(
          icon: Sym(MSym.arrowBack, size: 20, color: c.onSurface),
          onPressed: onBack,
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(member['name'] ?? '', style: KText.h3.copyWith(color: c.onSurface)),
            Text('Measurements', style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
          ],
        ),
        actions: [
          IconButton(
            icon: Sym(MSym.add, color: c.primary),
            onPressed: onAdd,
          ),
        ],
      ),
      body: loading
          ? const KLoading()
          : measurements.isEmpty
              ? KEmpty(
                  icon: MSym.monitorWeight,
                  message: 'No measurements yet',
                  action: TextButton.icon(
                    onPressed: onAdd,
                    icon: const Icon(Icons.add),
                    label: const Text('Add Measurement'),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (latest != null) ...[
                      _LatestCard(latest, c),
                      const SizedBox(height: 12),
                    ],
                    if (spots.length > 1) ...[
                      Text('Weight Trend',
                          style: KText.labelCaps.copyWith(color: c.onSurfaceVariant)),
                      const SizedBox(height: 8),
                      KCard(
                        child: SizedBox(
                          height: 160,
                          child: LineChart(
                            LineChartData(
                              gridData: FlGridData(show: false),
                              borderData: FlBorderData(show: false),
                              titlesData: FlTitlesData(
                                leftTitles: AxisTitles(
                                  sideTitles: SideTitles(
                                    showTitles: true,
                                    reservedSize: 40,
                                    getTitlesWidget: (v, _) => Text(
                                      '${v.toStringAsFixed(0)}kg',
                                      style: KText.bodyMd.copyWith(
                                          color: c.onSurfaceVariant, fontSize: 10),
                                    ),
                                  ),
                                ),
                                bottomTitles: AxisTitles(
                                    sideTitles: SideTitles(showTitles: false)),
                                topTitles: AxisTitles(
                                    sideTitles: SideTitles(showTitles: false)),
                                rightTitles: AxisTitles(
                                    sideTitles: SideTitles(showTitles: false)),
                              ),
                              lineBarsData: [
                                LineChartBarData(
                                  spots: spots,
                                  isCurved: true,
                                  color: c.primary,
                                  barWidth: 2,
                                  dotData: FlDotData(show: true),
                                  belowBarData: BarAreaData(
                                    show: true,
                                    color: c.primary.withValues(alpha: 0.08),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    Text('History (${measurements.length})',
                        style: KText.labelCaps.copyWith(color: c.onSurfaceVariant)),
                    const SizedBox(height: 8),
                    ...measurements.reversed.map(
                      (m) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _MeasurementCard(
                          m: m,
                          onEdit: () => onEdit(m),
                          onDelete: () => onDelete(m),
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}

class _LatestCard extends StatelessWidget {
  final Map<String, dynamic> m;
  final AppColors c;
  const _LatestCard(this.m, this.c);

  @override
  Widget build(BuildContext context) {
    final bmi = asNum(m['bmi']);
    Color bmiColor = TW.emerald600;
    if (bmi > 0) {
      if (bmi < 18.5) bmiColor = TW.blue600;
      else if (bmi > 25) bmiColor = TW.amber600;
      else if (bmi > 30) bmiColor = TW.rose600;
    }

    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Latest — ${fmtDate(m['date'] ?? '')}',
                  style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              if (asNum(m['weight']) > 0)
                _Stat('Weight', '${asNum(m['weight'])} kg', TW.blue600),
              if (asNum(m['height']) > 0)
                _Stat('Height', '${asNum(m['height'])} cm', TW.violet600),
              if (bmi > 0)
                _Stat('BMI', bmi.toStringAsFixed(1), bmiColor),
              if (asNum(m['bodyFat']) > 0)
                _Stat('Body Fat', '${asNum(m['bodyFat'])}%', TW.orange600),
              if (asNum(m['chest']) > 0)
                _Stat('Chest', '${asNum(m['chest'])} cm', c.onSurface),
              if (asNum(m['waist']) > 0)
                _Stat('Waist', '${asNum(m['waist'])} cm', c.onSurface),
              if (asNum(m['hips']) > 0)
                _Stat('Hips', '${asNum(m['hips'])} cm', c.onSurface),
              if (asNum(m['arms']) > 0)
                _Stat('Arms', '${asNum(m['arms'])} cm', c.onSurface),
              if (asNum(m['thighs']) > 0)
                _Stat('Thighs', '${asNum(m['thighs'])} cm', c.onSurface),
            ],
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _Stat(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value,
            style: KText.bodyLg
                .copyWith(color: color, fontWeight: FontWeight.w700, fontSize: 18)),
        Text(label,
            style: KText.bodyMd.copyWith(color: context.c.onSurfaceVariant, fontSize: 11)),
      ],
    );
  }
}

class _MeasurementCard extends StatelessWidget {
  final Map<String, dynamic> m;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _MeasurementCard({required this.m, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return KCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(fmtDate(m['date'] ?? ''),
                    style: KText.bodyMd.copyWith(
                        color: c.onSurface, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 12,
                  runSpacing: 2,
                  children: [
                    if (asNum(m['weight']) > 0)
                      Text('${asNum(m['weight'])} kg',
                          style: KText.bodyMd.copyWith(color: c.onSurface)),
                    if (asNum(m['bmi']) > 0)
                      Text('BMI: ${asNum(m['bmi']).toStringAsFixed(1)}',
                          style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                    if (asNum(m['bodyFat']) > 0)
                      Text('BF: ${asNum(m['bodyFat'])}%',
                          style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                  ],
                ),
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
    );
  }
}

// ── Measurement Form ──────────────────────────────────────────────────────────

class _MeasurementForm extends StatefulWidget {
  final Map<String, dynamic>? measurement;
  final String gymId;
  final Map<String, dynamic> member;
  final VoidCallback onSaved;
  const _MeasurementForm(
      {this.measurement,
      required this.gymId,
      required this.member,
      required this.onSaved});

  @override
  State<_MeasurementForm> createState() => _MeasurementFormState();
}

class _MeasurementFormState extends State<_MeasurementForm> {
  final _weightCtrl = TextEditingController();
  final _heightCtrl = TextEditingController();
  final _bodyFatCtrl = TextEditingController();
  final _chestCtrl = TextEditingController();
  final _waistCtrl = TextEditingController();
  final _hipsCtrl = TextEditingController();
  final _armsCtrl = TextEditingController();
  final _thighsCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  DateTime _date = DateTime.now();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final m = widget.measurement;
    if (m != null) {
      _weightCtrl.text = asNum(m['weight']) == 0 ? '' : asNum(m['weight']).toString();
      _heightCtrl.text = asNum(m['height']) == 0 ? '' : asNum(m['height']).toString();
      _bodyFatCtrl.text = asNum(m['bodyFat']) == 0 ? '' : asNum(m['bodyFat']).toString();
      _chestCtrl.text = asNum(m['chest']) == 0 ? '' : asNum(m['chest']).toString();
      _waistCtrl.text = asNum(m['waist']) == 0 ? '' : asNum(m['waist']).toString();
      _hipsCtrl.text = asNum(m['hips']) == 0 ? '' : asNum(m['hips']).toString();
      _armsCtrl.text = asNum(m['arms']) == 0 ? '' : asNum(m['arms']).toString();
      _thighsCtrl.text = asNum(m['thighs']) == 0 ? '' : asNum(m['thighs']).toString();
      _notesCtrl.text = m['notes'] ?? '';
      if ((m['date'] ?? '').isNotEmpty) {
        _date = DateTime.tryParse(m['date']) ?? DateTime.now();
      }
    }
  }

  @override
  void dispose() {
    _weightCtrl.dispose();
    _heightCtrl.dispose();
    _bodyFatCtrl.dispose();
    _chestCtrl.dispose();
    _waistCtrl.dispose();
    _hipsCtrl.dispose();
    _armsCtrl.dispose();
    _thighsCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  double _calcBmi() {
    final w = double.tryParse(_weightCtrl.text) ?? 0;
    final h = double.tryParse(_heightCtrl.text) ?? 0;
    if (w <= 0 || h <= 0) return 0;
    final hm = h / 100;
    return w / (hm * hm);
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(
        context: context, initialDate: _date, firstDate: DateTime(2010), lastDate: DateTime.now());
    if (d != null && mounted) setState(() => _date = d);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final bmi = _calcBmi();
    final data = {
      'memberId': widget.member['id'],
      'memberName': widget.member['name'] ?? '',
      'date': _date.toIso8601String().substring(0, 10),
      'weight': double.tryParse(_weightCtrl.text) ?? 0,
      'height': double.tryParse(_heightCtrl.text) ?? 0,
      'bodyFat': double.tryParse(_bodyFatCtrl.text) ?? 0,
      'chest': double.tryParse(_chestCtrl.text) ?? 0,
      'waist': double.tryParse(_waistCtrl.text) ?? 0,
      'hips': double.tryParse(_hipsCtrl.text) ?? 0,
      'arms': double.tryParse(_armsCtrl.text) ?? 0,
      'thighs': double.tryParse(_thighsCtrl.text) ?? 0,
      'bmi': double.parse(bmi.toStringAsFixed(2)),
      'notes': _notesCtrl.text.trim(),
    };
    try {
      if (widget.measurement != null) {
        await TenantDb.updateDocument(widget.gymId, 'measurements', widget.measurement!['id'], data);
      } else {
        await TenantDb.createDocument(widget.gymId, 'measurements', data);
      }
      if (mounted) Navigator.pop(context);
      widget.onSaved();
    } catch (_) {}
    if (mounted) setState(() => _saving = false);
  }

  Widget _field(String label, TextEditingController ctrl, {String suffix = ''}) {
    return TextField(
      controller: ctrl,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(
        labelText: suffix.isEmpty ? label : '$label ($suffix)',
        border: const OutlineInputBorder(),
        isDense: true,
      ),
      onChanged: (_) => setState(() {}),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isEdit = widget.measurement != null;
    final bmi = _calcBmi();

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
                Text(isEdit ? 'Edit Measurement' : 'Add Measurement',
                    style: KText.h3.copyWith(color: c.onSurface)),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Sym(MSym.close, size: 20, color: c.onSurfaceVariant),
                ),
              ],
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
                    isDense: true,
                  ),
                  controller: TextEditingController(
                      text: _date.toIso8601String().substring(0, 10)),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _field('Weight', _weightCtrl, suffix: 'kg')),
                const SizedBox(width: 12),
                Expanded(child: _field('Height', _heightCtrl, suffix: 'cm')),
              ],
            ),
            if (bmi > 0) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: c.primary.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Sym(MSym.monitorWeight, size: 16, color: c.primary),
                    const SizedBox(width: 6),
                    Text('BMI: ${bmi.toStringAsFixed(1)}',
                        style: KText.bodyMd.copyWith(
                            color: c.primary, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            _field('Body Fat', _bodyFatCtrl, suffix: '%'),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _field('Chest', _chestCtrl, suffix: 'cm')),
                const SizedBox(width: 12),
                Expanded(child: _field('Waist', _waistCtrl, suffix: 'cm')),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _field('Hips', _hipsCtrl, suffix: 'cm')),
                const SizedBox(width: 12),
                Expanded(child: _field('Arms', _armsCtrl, suffix: 'cm')),
              ],
            ),
            const SizedBox(height: 12),
            _field('Thighs', _thighsCtrl, suffix: 'cm'),
            const SizedBox(height: 12),
            TextField(
              controller: _notesCtrl,
              maxLines: 2,
              decoration:
                  const InputDecoration(labelText: 'Notes', border: OutlineInputBorder(), isDense: true),
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
                    : Text(isEdit ? 'Save Changes' : 'Add Measurement'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
