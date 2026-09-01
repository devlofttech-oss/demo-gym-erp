import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

const _supCategories = [
  'All',
  'Protein',
  'Creatine',
  'Pre-Workout',
  'Vitamins',
  'Fat Burner',
  'BCAA',
  'Other',
];

class SupplementsScreen extends StatefulWidget {
  const SupplementsScreen({super.key});
  @override
  State<SupplementsScreen> createState() => _SupplementsScreenState();
}

class _SupplementsScreenState extends State<SupplementsScreen>
    with SingleTickerProviderStateMixin {
  List<Map<String, dynamic>> _inventory = [];
  List<Map<String, dynamic>> _sales = [];
  bool _loading = true;
  late TabController _tabCtrl;
  int _catTab = 0;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _fetch();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    final gymId = context.read<AuthProvider>().gymId;
    if (mounted) setState(() => _loading = true);
    try {
      final res = await Future.wait([
        TenantDb.getCollection(gymId, 'supplements'),
        TenantDb.getCollection(gymId, 'supplementSales'),
      ]);
      final sales = res[1]
        ..sort((a, b) => (b['date'] as String? ?? '').compareTo(a['date'] as String? ?? ''));
      if (mounted) setState(() { _inventory = res[0]; _sales = sales; });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _filteredInventory {
    if (_catTab == 0) return _inventory;
    final cat = _supCategories[_catTab];
    return _inventory.where((s) => (s['category'] ?? '') == cat).toList();
  }

  void _showAddForm() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SupplementForm(
        gymId: context.read<AuthProvider>().gymId ?? '',
        onSaved: _fetch,
      ),
    );
  }

  void _showSellSheet(Map<String, dynamic> supp) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SellSheet(
        supplement: supp,
        gymId: context.read<AuthProvider>().gymId ?? '',
        onSaved: _fetch,
      ),
    );
  }

  void _showRestockSheet(Map<String, dynamic> supp) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _RestockSheet(
        supplement: supp,
        gymId: context.read<AuthProvider>().gymId ?? '',
        onSaved: _fetch,
      ),
    );
  }

  Future<void> _delete(Map<String, dynamic> s) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Supplement'),
        content: Text('Delete "${s['name']}"?'),
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
      await TenantDb.deleteDocument(context.read<AuthProvider>().gymId ?? '', 'supplements', s['id']);
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
        title: Text('Supplements', style: KText.h3.copyWith(color: c.onSurface)),
        actions: [
          if (_tabCtrl.index == 0)
            IconButton(
              icon: Sym(MSym.add, color: c.primary),
              onPressed: _showAddForm,
              tooltip: 'Add supplement',
            ),
        ],
        bottom: TabBar(
          controller: _tabCtrl,
          onTap: (_) => setState(() {}),
          tabs: const [
            Tab(text: 'Inventory'),
            Tab(text: 'Sales Log'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: [
          _InventoryTab(
            inventory: _filteredInventory,
            allInventory: _inventory,
            loading: _loading,
            catTab: _catTab,
            onCatTab: (i) => setState(() => _catTab = i),
            onSell: _showSellSheet,
            onRestock: _showRestockSheet,
            onDelete: _delete,
            onRefresh: _fetch,
          ),
          _SalesLogTab(sales: _sales, loading: _loading, onRefresh: _fetch),
        ],
      ),
    );
  }
}

class _InventoryTab extends StatelessWidget {
  final List<Map<String, dynamic>> inventory;
  final List<Map<String, dynamic>> allInventory;
  final bool loading;
  final int catTab;
  final ValueChanged<int> onCatTab;
  final ValueChanged<Map<String, dynamic>> onSell;
  final ValueChanged<Map<String, dynamic>> onRestock;
  final ValueChanged<Map<String, dynamic>> onDelete;
  final Future<void> Function() onRefresh;
  const _InventoryTab({
    required this.inventory,
    required this.allInventory,
    required this.loading,
    required this.catTab,
    required this.onCatTab,
    required this.onSell,
    required this.onRestock,
    required this.onDelete,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: SizedBox(
              height: 44,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                itemCount: _supCategories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) => FilterChip(
                  label: Text(_supCategories[i]),
                  selected: catTab == i,
                  onSelected: (_) => onCatTab(i),
                  showCheckmark: false,
                ),
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 8)),
          if (loading)
            const SliverFillRemaining(child: KLoading())
          else if (inventory.isEmpty)
            SliverFillRemaining(
              child: KEmpty(
                icon: MSym.medication,
                message: catTab == 0 ? 'No supplements added' : 'No ${_supCategories[catTab]} supplements',
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) => _InventoryCard(
                    supp: inventory[i],
                    onSell: () => onSell(inventory[i]),
                    onRestock: () => onRestock(inventory[i]),
                    onDelete: () => onDelete(inventory[i]),
                  ),
                  childCount: inventory.length,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _InventoryCard extends StatelessWidget {
  final Map<String, dynamic> supp;
  final VoidCallback onSell;
  final VoidCallback onRestock;
  final VoidCallback onDelete;
  const _InventoryCard(
      {required this.supp, required this.onSell, required this.onRestock, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final stock = asNum(supp['stock']).toInt();
    final price = asNum(supp['price']);
    final expiry = supp['expiryDate'] as String?;
    final isOut = stock <= 0;
    final isLow = !isOut && stock < 10;

    final stockColor = isOut ? TW.rose600 : isLow ? TW.amber600 : TW.emerald600;
    final stockBg = isOut
        ? TW.rose600.withValues(alpha: 0.1)
        : isLow
            ? TW.amber600.withValues(alpha: 0.1)
            : TW.emerald500.withValues(alpha: 0.1);
    final stockLabel = isOut ? 'Out of Stock' : isLow ? 'Low ($stock)' : 'In Stock ($stock)';

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
                    color: TW.emerald500.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Sym(MSym.medication, color: TW.emerald600, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(supp['name'] ?? '',
                          style: KText.bodyLg.copyWith(
                              color: c.onSurface, fontWeight: FontWeight.w600)),
                      Row(children: [
                        if ((supp['category'] ?? '').isNotEmpty)
                          Pill(supp['category'],
                              bg: TW.emerald500.withValues(alpha: 0.08), fg: TW.emerald600),
                        const SizedBox(width: 6),
                        Pill(stockLabel, bg: stockBg, fg: stockColor, dot: true),
                      ]),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  icon: Sym(MSym.expandMore, size: 18, color: c.onSurfaceVariant),
                  onSelected: (v) {
                    if (v == 'delete') onDelete();
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(
                        value: 'delete',
                        child: Text('Delete', style: TextStyle(color: TW.rose600))),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                if (price > 0) ...[
                  Text(rupees(price),
                      style:
                          KText.bodyMd.copyWith(color: c.onSurface, fontWeight: FontWeight.w600)),
                  Text(' / unit', style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                  const SizedBox(width: 12),
                ],
                if (expiry != null && expiry.isNotEmpty)
                  Text('Exp: ${fmtDate(expiry)}',
                      style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
              ],
            ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: isOut ? null : onSell,
                  icon: Sym(MSym.sell, size: 16, color: isOut ? TW.slate400 : c.primary),
                  label: const Text('Sell'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton.icon(
                  onPressed: onRestock,
                  icon: Sym(MSym.add, size: 16, color: Colors.white),
                  label: const Text('Restock'),
                  style: FilledButton.styleFrom(backgroundColor: TW.emerald600),
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }
}

class _SalesLogTab extends StatelessWidget {
  final List<Map<String, dynamic>> sales;
  final bool loading;
  final Future<void> Function() onRefresh;
  const _SalesLogTab({required this.sales, required this.loading, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: loading
          ? const KLoading()
          : sales.isEmpty
              ? KEmpty(icon: MSym.history, message: 'No sales recorded yet')
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  itemCount: sales.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final s = sales[i];
                    final qty = asNum(s['quantity']).toInt();
                    final total = asNum(s['total']);
                    return KCard(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: TW.emerald500.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Sym(MSym.shoppingCart, color: TW.emerald600, size: 18),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(s['name'] ?? '',
                                    style: KText.bodyLg.copyWith(
                                        color: c.onSurface, fontWeight: FontWeight.w600)),
                                Text('$qty unit${qty != 1 ? 's' : ''} · ${fmtDate(s['date'])}',
                                    style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                              ],
                            ),
                          ),
                          Text(rupees(total),
                              style: KText.bodyLg.copyWith(
                                  color: TW.emerald600, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}

class _SupplementForm extends StatefulWidget {
  final String gymId;
  final VoidCallback onSaved;
  const _SupplementForm({required this.gymId, required this.onSaved});

  @override
  State<_SupplementForm> createState() => _SupplementFormState();
}

class _SupplementFormState extends State<_SupplementForm> {
  final _nameCtrl = TextEditingController();
  final _stockCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  String _category = 'Protein';
  String _expiryDate = '';
  bool _saving = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _stockCtrl.dispose();
    _priceCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickExpiry() async {
    final d = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 90)),
      firstDate: DateTime.now(),
      lastDate: DateTime(2040),
    );
    if (d != null) setState(() => _expiryDate = d.toIso8601String().split('T').first);
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);
    final data = {
      'name': _nameCtrl.text.trim(),
      'category': _category,
      'stock': int.tryParse(_stockCtrl.text) ?? 0,
      'price': num.tryParse(_priceCtrl.text) ?? 0,
      'expiryDate': _expiryDate,
    };
    try {
      await TenantDb.createDocument(widget.gymId, 'supplements', data);
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
                Text('Add Supplement', style: KText.h3.copyWith(color: c.onSurface)),
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
              decoration: const InputDecoration(labelText: 'Name *', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _category,
              decoration:
                  const InputDecoration(labelText: 'Category', border: OutlineInputBorder()),
              items: _supCategories
                  .skip(1)
                  .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                  .toList(),
              onChanged: (v) => setState(() => _category = v!),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _stockCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: 'Initial Stock', border: OutlineInputBorder()),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _priceCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: 'Price / unit (₹)', border: OutlineInputBorder()),
                ),
              ),
            ]),
            const SizedBox(height: 12),
            InkWell(
              onTap: _pickExpiry,
              child: InputDecorator(
                decoration:
                    const InputDecoration(labelText: 'Expiry Date', border: OutlineInputBorder()),
                child: Text(
                    _expiryDate.isEmpty ? 'Tap to select' : fmtDate(_expiryDate),
                    style: KText.bodyMd
                        .copyWith(color: _expiryDate.isEmpty ? TW.slate400 : context.c.onSurface)),
              ),
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
                    : const Text('Add Supplement'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SellSheet extends StatefulWidget {
  final Map<String, dynamic> supplement;
  final String gymId;
  final VoidCallback onSaved;
  const _SellSheet({required this.supplement, required this.gymId, required this.onSaved});

  @override
  State<_SellSheet> createState() => _SellSheetState();
}

class _SellSheetState extends State<_SellSheet> {
  final _qtyCtrl = TextEditingController(text: '1');
  bool _saving = false;

  @override
  void dispose() {
    _qtyCtrl.dispose();
    super.dispose();
  }

  Future<void> _sell() async {
    final qty = int.tryParse(_qtyCtrl.text) ?? 0;
    if (qty <= 0) return;
    final currentStock = asNum(widget.supplement['stock']).toInt();
    if (qty > currentStock) return;
    setState(() => _saving = true);
    final price = asNum(widget.supplement['price']);
    try {
      await Future.wait([
        TenantDb.updateDocument(widget.gymId, 'supplements', widget.supplement['id'], {
          'stock': currentStock - qty,
        }),
        TenantDb.createDocument(widget.gymId, 'supplementSales', {
          'supplementId': widget.supplement['id'],
          'name': widget.supplement['name'],
          'category': widget.supplement['category'],
          'quantity': qty,
          'unitPrice': price,
          'total': price * qty,
          'date': todayStr(),
        }),
      ]);
      if (mounted) Navigator.pop(context);
      widget.onSaved();
    } catch (_) {}
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final price = asNum(widget.supplement['price']);
    final qty = int.tryParse(_qtyCtrl.text) ?? 1;
    final total = price * qty;

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
              Text('Sell — ${widget.supplement['name']}',
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
            controller: _qtyCtrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Quantity *', border: OutlineInputBorder()),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Text('Unit price: ', style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
              Text(rupees(price),
                  style: KText.bodyMd.copyWith(color: c.onSurface, fontWeight: FontWeight.w600)),
              const Spacer(),
              Text('Total: ', style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
              Text(rupees(total),
                  style:
                      KText.bodyLg.copyWith(color: TW.emerald600, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _sell,
              style: FilledButton.styleFrom(backgroundColor: TW.emerald600),
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Confirm Sale'),
            ),
          ),
        ],
      ),
    );
  }
}

class _RestockSheet extends StatefulWidget {
  final Map<String, dynamic> supplement;
  final String gymId;
  final VoidCallback onSaved;
  const _RestockSheet({required this.supplement, required this.gymId, required this.onSaved});

  @override
  State<_RestockSheet> createState() => _RestockSheetState();
}

class _RestockSheetState extends State<_RestockSheet> {
  final _qtyCtrl = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _qtyCtrl.dispose();
    super.dispose();
  }

  Future<void> _restock() async {
    final qty = int.tryParse(_qtyCtrl.text) ?? 0;
    if (qty <= 0) return;
    setState(() => _saving = true);
    final current = asNum(widget.supplement['stock']).toInt();
    try {
      await TenantDb.updateDocument(widget.gymId, 'supplements', widget.supplement['id'], {
        'stock': current + qty,
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
              Text('Restock — ${widget.supplement['name']}',
                  style: KText.h3.copyWith(color: c.onSurface)),
              const Spacer(),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: Sym(MSym.close, size: 20, color: c.onSurfaceVariant),
              ),
            ],
          ),
          Text(
              'Current stock: ${asNum(widget.supplement['stock']).toInt()} units',
              style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
          const SizedBox(height: 16),
          TextField(
            controller: _qtyCtrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
                labelText: 'Units to add *', border: OutlineInputBorder()),
            autofocus: true,
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _restock,
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Add Stock'),
            ),
          ),
        ],
      ),
    );
  }
}
