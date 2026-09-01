import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

class EquipmentScreen extends StatefulWidget {
  const EquipmentScreen({super.key});
  @override
  State<EquipmentScreen> createState() => _EquipmentScreenState();
}

class _EquipmentScreenState extends State<EquipmentScreen> {
  List<Map<String, dynamic>> _equipment = [];
  bool _loading = true;
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
      final res = await TenantDb.getCollection(gymId, 'equipment');
      if (mounted) setState(() => _equipment = res);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _filtered {
    if (_search.isEmpty) return _equipment;
    final term = _search.toLowerCase();
    return _equipment
        .where((e) => (e['name'] as String?)?.toLowerCase().contains(term) ?? false)
        .toList();
  }

  _ServiceStatus _status(Map<String, dynamic> e) {
    final nextStr = e['nextServiceDate'] as String?;
    if (nextStr == null || nextStr.isEmpty) return _ServiceStatus.ok;
    final next = DateTime.tryParse(nextStr);
    if (next == null) return _ServiceStatus.ok;
    final now = DateTime.now();
    final diff = next.difference(now).inDays;
    if (diff < 0) return _ServiceStatus.overdue;
    if (diff <= 30) return _ServiceStatus.dueSoon;
    return _ServiceStatus.ok;
  }

  List<Map<String, dynamic>> get _overdueList =>
      _equipment.where((e) => _status(e) == _ServiceStatus.overdue).toList();
  List<Map<String, dynamic>> get _dueSoonList =>
      _equipment.where((e) => _status(e) == _ServiceStatus.dueSoon).toList();

  void _showForm([Map<String, dynamic>? eq]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EquipmentForm(
        equipment: eq,
        gymId: context.read<AuthProvider>().gymId ?? '',
        onSaved: _fetch,
      ),
    );
  }

  Future<void> _delete(Map<String, dynamic> eq) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Equipment'),
        content: Text('Delete "${eq['name']}"?'),
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
      await TenantDb.deleteDocument(context.read<AuthProvider>().gymId ?? '', 'equipment', eq['id']);
      _fetch();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final filtered = _filtered;
    final overdue = _overdueList;
    final dueSoon = _dueSoonList;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        leading: IconButton(
          icon: Sym(MSym.arrowBack, size: 20, color: c.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Equipment', style: KText.h3.copyWith(color: c.onSurface)),
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
            // Alert banners
            if (!_loading && (overdue.isNotEmpty || dueSoon.isNotEmpty))
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Column(
                    children: [
                      if (overdue.isNotEmpty)
                        _AlertBanner(
                          icon: MSym.warning,
                          color: TW.rose600,
                          message:
                              '${overdue.length} equipment overdue for service: ${overdue.map((e) => e['name']).join(', ')}',
                        ),
                      if (dueSoon.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        _AlertBanner(
                          icon: MSym.alarm,
                          color: TW.amber600,
                          message:
                              '${dueSoon.length} equipment due for service within 30 days',
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: TextField(
                  controller: _searchCtrl,
                  decoration: InputDecoration(
                    hintText: 'Search equipment…',
                    prefixIcon: Sym(MSym.search, size: 20, color: c.onSurfaceVariant),
                    isDense: true,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  onChanged: (v) => setState(() => _search = v),
                ),
              ),
            ),
            if (_loading)
              const SliverFillRemaining(child: KLoading())
            else if (filtered.isEmpty)
              SliverFillRemaining(
                child: KEmpty(
                  icon: MSym.fitnessCenter,
                  message: 'No equipment yet',
                  action: TextButton.icon(
                    onPressed: () => _showForm(),
                    icon: const Icon(Icons.add),
                    label: const Text('Add Equipment'),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => _EquipmentCard(
                      equipment: filtered[i],
                      status: _status(filtered[i]),
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

enum _ServiceStatus { overdue, dueSoon, ok }

class _AlertBanner extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String message;
  const _AlertBanner({required this.icon, required this.color, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Sym(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(message,
                style: KText.bodyMd.copyWith(color: color, fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}

class _EquipmentCard extends StatelessWidget {
  final Map<String, dynamic> equipment;
  final _ServiceStatus status;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _EquipmentCard(
      {required this.equipment,
      required this.status,
      required this.onEdit,
      required this.onDelete});

  Color get _statusColor {
    switch (status) {
      case _ServiceStatus.overdue:
        return TW.rose600;
      case _ServiceStatus.dueSoon:
        return TW.amber600;
      case _ServiceStatus.ok:
        return TW.emerald600;
    }
  }

  String get _statusLabel {
    switch (status) {
      case _ServiceStatus.overdue:
        return 'Overdue';
      case _ServiceStatus.dueSoon:
        return 'Due Soon';
      case _ServiceStatus.ok:
        return 'OK';
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;

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
                    color: TW.slate500.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Sym(MSym.build, color: TW.slate500, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(equipment['name'] ?? '',
                          style: KText.bodyLg.copyWith(
                              color: c.onSurface, fontWeight: FontWeight.w600)),
                      Row(
                        children: [
                          Pill(
                            _statusLabel,
                            bg: _statusColor.withValues(alpha: 0.1),
                            fg: _statusColor,
                          ),
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
            const SizedBox(height: 8),
            Row(
              children: [
                if (asNum(equipment['price']) > 0) ...[
                  Sym(MSym.payments, size: 14, color: c.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text('₹${grouped(asNum(equipment['price']))}',
                      style: KText.bodyMd.copyWith(color: c.onSurface)),
                  const SizedBox(width: 12),
                ],
                if ((equipment['purchaseDate'] ?? '').isNotEmpty) ...[
                  Sym(MSym.calendarToday, size: 14, color: c.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text('Purchased: ${fmtDate(equipment['purchaseDate'])}',
                      style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                ],
              ],
            ),
            if ((equipment['nextServiceDate'] ?? '').isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Sym(MSym.build, size: 14,
                      color: status == _ServiceStatus.ok ? c.onSurfaceVariant : _statusColor),
                  const SizedBox(width: 4),
                  Text('Next service: ${fmtDate(equipment['nextServiceDate'])}',
                      style: KText.bodyMd.copyWith(
                          color: status == _ServiceStatus.ok
                              ? c.onSurfaceVariant
                              : _statusColor,
                          fontWeight: status == _ServiceStatus.ok
                              ? FontWeight.normal
                              : FontWeight.w600)),
                ],
              ),
            ],
            if ((equipment['notes'] ?? '').isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(equipment['notes'],
                  style: KText.bodyMd.copyWith(color: c.onSurfaceVariant),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Equipment Form ────────────────────────────────────────────────────────────

class _EquipmentForm extends StatefulWidget {
  final Map<String, dynamic>? equipment;
  final String gymId;
  final VoidCallback onSaved;
  const _EquipmentForm({this.equipment, required this.gymId, required this.onSaved});

  @override
  State<_EquipmentForm> createState() => _EquipmentFormState();
}

class _EquipmentFormState extends State<_EquipmentForm> {
  final _nameCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  DateTime? _purchaseDate;
  DateTime? _nextServiceDate;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final eq = widget.equipment;
    if (eq != null) {
      _nameCtrl.text = eq['name'] ?? '';
      _priceCtrl.text = asNum(eq['price']) == 0 ? '' : asNum(eq['price']).toString();
      _notesCtrl.text = eq['notes'] ?? '';
      if ((eq['purchaseDate'] ?? '').isNotEmpty) {
        _purchaseDate = DateTime.tryParse(eq['purchaseDate']);
      }
      if ((eq['nextServiceDate'] ?? '').isNotEmpty) {
        _nextServiceDate = DateTime.tryParse(eq['nextServiceDate']);
      }
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _priceCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate(bool isService) async {
    final initial = isService
        ? (_nextServiceDate ?? DateTime.now().add(const Duration(days: 90)))
        : (_purchaseDate ?? DateTime.now());
    final d = await showDatePicker(
        context: context,
        initialDate: initial,
        firstDate: DateTime(2000),
        lastDate: DateTime(2040));
    if (d != null && mounted) {
      setState(() {
        if (isService) {
          _nextServiceDate = d;
        } else {
          _purchaseDate = d;
        }
      });
    }
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);
    final data = {
      'name': _nameCtrl.text.trim(),
      'price': double.tryParse(_priceCtrl.text) ?? 0,
      'purchaseDate': _purchaseDate?.toIso8601String().substring(0, 10) ?? '',
      'nextServiceDate': _nextServiceDate?.toIso8601String().substring(0, 10) ?? '',
      'notes': _notesCtrl.text.trim(),
    };
    try {
      if (widget.equipment != null) {
        await TenantDb.updateDocument(widget.gymId, 'equipment', widget.equipment!['id'], data);
      } else {
        await TenantDb.createDocument(widget.gymId, 'equipment', data);
      }
      if (mounted) Navigator.pop(context);
      widget.onSaved();
    } catch (_) {}
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isEdit = widget.equipment != null;

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
                Text(isEdit ? 'Edit Equipment' : 'Add Equipment',
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
                  labelText: 'Equipment Name *', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _priceCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                  labelText: 'Price (₹)', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: () => _pickDate(false),
              child: AbsorbPointer(
                child: TextField(
                  decoration: InputDecoration(
                    labelText: 'Purchase Date',
                    border: const OutlineInputBorder(),
                    suffixIcon: Sym(MSym.calendarToday, size: 18, color: c.onSurfaceVariant),
                  ),
                  controller: TextEditingController(
                      text: _purchaseDate != null
                          ? _purchaseDate!.toIso8601String().substring(0, 10)
                          : ''),
                ),
              ),
            ),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: () => _pickDate(true),
              child: AbsorbPointer(
                child: TextField(
                  decoration: InputDecoration(
                    labelText: 'Next Service Date',
                    border: const OutlineInputBorder(),
                    suffixIcon: Sym(MSym.build, size: 18, color: c.onSurfaceVariant),
                  ),
                  controller: TextEditingController(
                      text: _nextServiceDate != null
                          ? _nextServiceDate!.toIso8601String().substring(0, 10)
                          : ''),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notesCtrl,
              maxLines: 2,
              decoration: const InputDecoration(
                  labelText: 'Notes', border: OutlineInputBorder()),
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
                    : Text(isEdit ? 'Save Changes' : 'Add Equipment'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
