import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

const _categories = [
  'All',
  'Rent',
  'Electricity',
  'Salaries',
  'Equipment',
  'Supplements',
  'Maintenance',
  'Marketing',
  'Other',
];

const _payModes = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

const _catColor = {
  'Rent': TW.blue600,
  'Electricity': TW.amber600,
  'Salaries': TW.violet600,
  'Equipment': TW.sky600,
  'Supplements': TW.emerald600,
  'Maintenance': TW.orange600,
  'Marketing': TW.pink600,
  'Other': TW.slate500,
};

const _catIcon = {
  'Rent': MSym.receiptLong,
  'Electricity': MSym.payments,
  'Salaries': MSym.badge,
  'Equipment': MSym.fitnessCenter,
  'Supplements': MSym.medication,
  'Maintenance': MSym.settings,
  'Marketing': MSym.campaign,
  'Other': MSym.receiptLong,
};

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});
  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  List<Map<String, dynamic>> _expenses = [];
  bool _loading = true;
  int _catTab = 0;
  late DateTime _month;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
    _fetch();
  }

  Future<void> _fetch() async {
    final gymId = context.read<AuthProvider>().gymId;
    if (mounted) setState(() => _loading = true);
    try {
      final res = await TenantDb.getCollection(gymId, 'expenses');
      res.sort((a, b) => (b['date'] as String? ?? '').compareTo(a['date'] as String? ?? ''));
      if (mounted) setState(() => _expenses = res);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _monthExpenses =>
      _expenses.where((e) => _inMonth(e['date'])).toList();

  bool _inMonth(dynamic d) {
    final s = d as String?;
    if (s == null || s.isEmpty) return false;
    return s.startsWith('${_month.year}-${_month.month.toString().padLeft(2, '0')}');
  }

  List<Map<String, dynamic>> get _filtered {
    var list = _monthExpenses;
    if (_catTab > 0) {
      final cat = _categories[_catTab];
      list = list.where((e) => (e['category'] ?? '') == cat).toList();
    }
    return list;
  }

  num get _monthTotal => _monthExpenses.fold<num>(0, (s, e) => s + asNum(e['amount']));
  int get _recurringCount => _monthExpenses.where((e) => e['isRecurring'] == true).length;

  void _prevMonth() => setState(() => _month = DateTime(_month.year, _month.month - 1));
  void _nextMonth() {
    final now = DateTime.now();
    if (_month.year == now.year && _month.month == now.month) return;
    setState(() => _month = DateTime(_month.year, _month.month + 1));
  }

  void _showForm([Map<String, dynamic>? expense]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ExpenseForm(
        expense: expense,
        gymId: context.read<AuthProvider>().gymId ?? '',
        defaultDate: '${_month.year}-${_month.month.toString().padLeft(2, '0')}-01',
        onSaved: _fetch,
      ),
    );
  }

  Future<void> _delete(Map<String, dynamic> e) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Expense'),
        content: Text('Delete this ${e['category']} expense of ${rupees(asNum(e['amount']))}?'),
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
      await TenantDb.deleteDocument(context.read<AuthProvider>().gymId ?? '', 'expenses', e['id']);
      _fetch();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final filtered = _filtered;
    final monthLabel = DateFormat('MMMM yyyy').format(_month);
    final now = DateTime.now();
    final isCurrentMonth = _month.year == now.year && _month.month == now.month;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        leading: IconButton(
          icon: Sym(MSym.arrowBack, size: 20, color: c.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Expenses', style: KText.h3.copyWith(color: c.onSurface)),
        actions: [
          IconButton(
            icon: Sym(MSym.add, color: c.primary),
            onPressed: () => _showForm(),
            tooltip: 'Add expense',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetch,
        child: CustomScrollView(
          slivers: [
            // Month picker
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    IconButton(
                      icon: Sym(MSym.chevronLeft, color: c.onSurface),
                      onPressed: _prevMonth,
                    ),
                    Expanded(
                      child: Text(monthLabel,
                          textAlign: TextAlign.center,
                          style: KText.h3.copyWith(color: c.onSurface)),
                    ),
                    IconButton(
                      icon: Sym(MSym.chevronRight,
                          color: isCurrentMonth ? TW.slate400 : c.onSurface),
                      onPressed: isCurrentMonth ? null : _nextMonth,
                    ),
                  ],
                ),
              ),
            ),
            // Summary cards
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: _SummaryCard(
                        label: 'This month',
                        value: rupees(_monthTotal),
                        color: TW.rose600,
                        icon: MSym.receiptLong,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _SummaryCard(
                        label: 'Recurring',
                        value: '$_recurringCount entries',
                        color: TW.amber600,
                        icon: MSym.repeat,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // Category filter
            SliverToBoxAdapter(
              child: SizedBox(
                height: 44,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _categories.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) => FilterChip(
                    label: Text(_categories[i]),
                    selected: _catTab == i,
                    onSelected: (_) => setState(() => _catTab = i),
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
                  icon: MSym.receiptLong,
                  message: _catTab == 0
                      ? 'No expenses for $monthLabel'
                      : 'No ${_categories[_catTab]} expenses',
                  action: _catTab == 0
                      ? TextButton.icon(
                          onPressed: () => _showForm(),
                          icon: const Icon(Icons.add),
                          label: const Text('Add Expense'),
                        )
                      : null,
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => _ExpenseCard(
                      expense: filtered[i],
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

class _SummaryCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  const _SummaryCard(
      {required this.label, required this.value, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return KCard(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Sym(icon, color: color, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    style: KText.bodyLg.copyWith(color: c.onSurface, fontWeight: FontWeight.w700),
                    overflow: TextOverflow.ellipsis),
                Text(label, style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ExpenseCard extends StatelessWidget {
  final Map<String, dynamic> expense;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _ExpenseCard({required this.expense, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final cat = expense['category'] as String? ?? 'Other';
    final color = _catColor[cat] ?? TW.slate500;
    final icon = _catIcon[cat] ?? MSym.receiptLong;
    final amount = asNum(expense['amount']);
    final isRecurring = expense['isRecurring'] == true;
    final desc = expense['description'] as String? ?? '';
    final mode = expense['paymentMode'] as String? ?? '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: KCard(
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Sym(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Pill(cat, bg: color.withValues(alpha: 0.1), fg: color),
                      if (isRecurring) ...[
                        const SizedBox(width: 6),
                        Pill('Recurring',
                            bg: TW.amber500.withValues(alpha: 0.1), fg: TW.amber600,
                            icon: MSym.repeat),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(rupees(amount),
                      style: KText.bodyLg.copyWith(
                          color: c.onSurface, fontWeight: FontWeight.w700)),
                  Row(
                    children: [
                      Text(fmtDate(expense['date']),
                          style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                      if (mode.isNotEmpty) ...[
                        Text(' · ', style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                        Text(mode, style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                      ],
                    ],
                  ),
                  if (desc.isNotEmpty)
                    Text(desc,
                        style: KText.bodyMd.copyWith(color: c.onSurfaceVariant),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
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

class _ExpenseForm extends StatefulWidget {
  final Map<String, dynamic>? expense;
  final String gymId;
  final String defaultDate;
  final VoidCallback onSaved;
  const _ExpenseForm(
      {this.expense, required this.gymId, required this.defaultDate, required this.onSaved});

  @override
  State<_ExpenseForm> createState() => _ExpenseFormState();
}

class _ExpenseFormState extends State<_ExpenseForm> {
  final _amountCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _category = 'Rent';
  String _payMode = 'Cash';
  String _date = '';
  bool _isRecurring = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final e = widget.expense;
    if (e != null) {
      _amountCtrl.text = asNum(e['amount']) == 0 ? '' : asNum(e['amount']).toString();
      _descCtrl.text = e['description'] ?? '';
      _category = e['category'] ?? 'Rent';
      _payMode = e['paymentMode'] ?? 'Cash';
      _date = e['date'] ?? widget.defaultDate;
      _isRecurring = e['isRecurring'] == true;
    } else {
      _date = todayStr();
    }
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_date) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (d != null) setState(() => _date = d.toIso8601String().split('T').first);
  }

  Future<void> _save() async {
    if (_amountCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);
    final data = {
      'category': _category,
      'amount': num.tryParse(_amountCtrl.text) ?? 0,
      'date': _date,
      'description': _descCtrl.text.trim(),
      'paymentMode': _payMode,
      'isRecurring': _isRecurring,
    };
    try {
      if (widget.expense != null) {
        await TenantDb.updateDocument(widget.gymId, 'expenses', widget.expense!['id'], data);
      } else {
        await TenantDb.createDocument(widget.gymId, 'expenses', data);
      }
      if (mounted) Navigator.pop(context);
      widget.onSaved();
    } catch (_) {}
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isEdit = widget.expense != null;

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
                Text(isEdit ? 'Edit Expense' : 'Log Expense',
                    style: KText.h3.copyWith(color: c.onSurface)),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Sym(MSym.close, size: 20, color: c.onSurfaceVariant),
                ),
              ],
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _category,
              decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder()),
              items: _categories
                  .skip(1)
                  .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                  .toList(),
              onChanged: (v) => setState(() => _category = v!),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _amountCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                  labelText: 'Amount (₹) *', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: InkWell(
                  onTap: _pickDate,
                  child: InputDecorator(
                    decoration:
                        const InputDecoration(labelText: 'Date', border: OutlineInputBorder()),
                    child: Text(fmtDate(_date),
                        style: KText.bodyMd.copyWith(color: c.onSurface)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _payMode,
                  decoration: const InputDecoration(
                      labelText: 'Payment Mode', border: OutlineInputBorder()),
                  items: _payModes
                      .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                      .toList(),
                  onChanged: (v) => setState(() => _payMode = v!),
                ),
              ),
            ]),
            const SizedBox(height: 12),
            TextField(
              controller: _descCtrl,
              maxLines: 2,
              decoration:
                  const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 4),
            SwitchListTile(
              value: _isRecurring,
              onChanged: (v) => setState(() => _isRecurring = v),
              title: const Text('Recurring expense'),
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
                    : Text(isEdit ? 'Save Changes' : 'Log Expense'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
