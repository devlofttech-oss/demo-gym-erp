import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/whatsapp_sheet.dart';
import '../members/add_member_screen.dart';

const _statuses = ['All', 'New', 'Contacted', 'Follow-up', 'Interested', 'Won', 'Lost'];
const _sources = ['Walk-in', 'Phone', 'WhatsApp', 'Website', 'Referral', 'Other'];

const _statusColor = {
  'New': TW.blue600,
  'Contacted': TW.violet600,
  'Follow-up': TW.amber600,
  'Interested': TW.emerald600,
  'Won': TW.emerald600,
  'Lost': TW.rose600,
};

class LeadsScreen extends StatefulWidget {
  const LeadsScreen({super.key});
  @override
  State<LeadsScreen> createState() => _LeadsScreenState();
}

class _LeadsScreenState extends State<LeadsScreen> {
  List<Map<String, dynamic>> _leads = [];
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
      final res = await TenantDb.getCollection(gymId, 'leads');
      res.sort((a, b) {
        final bDate = toDate(b['createdAt']) ?? DateTime(1970);
        final aDate = toDate(a['createdAt']) ?? DateTime(1970);
        return bDate.compareTo(aDate);
      });
      if (mounted) setState(() => _leads = res);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _filtered {
    var list = _leads;
    if (_tab > 0) {
      final s = _statuses[_tab];
      list = list.where((l) => (l['status'] ?? '') == s).toList();
    }
    if (_search.isNotEmpty) {
      final term = _search.toLowerCase();
      list = list
          .where((l) =>
              ((l['name'] as String?)?.toLowerCase().contains(term) ?? false) ||
              ((l['phone'] as String?)?.contains(term) ?? false))
          .toList();
    }
    return list;
  }

  bool _followUpToday(Map<String, dynamic> lead) {
    final fu = lead['nextFollowUp'] as String?;
    if (fu == null || fu.isEmpty) return false;
    return fu == todayStr();
  }

  int get _followUpTodayCount => _leads.where(_followUpToday).length;

  void _showForm([Map<String, dynamic>? lead]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LeadForm(
        lead: lead,
        gymId: context.read<AuthProvider>().gymId ?? '',
        onSaved: _fetch,
      ),
    );
  }

  Future<void> _delete(Map<String, dynamic> lead) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Lead'),
        content: Text('Delete "${lead['name']}"?'),
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
      await TenantDb.deleteDocument(context.read<AuthProvider>().gymId ?? '', 'leads', lead['id']);
      _fetch();
    }
  }

  void _convertToMember(Map<String, dynamic> lead) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => AddMemberScreen(
          prefillName: lead['name'] as String?,
          prefillPhone: lead['phone'] as String?,
        ),
      ),
    ).then((_) => _fetch());
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
        title: Text('Leads', style: KText.h3.copyWith(color: c.onSurface)),
        actions: [
          IconButton(
            icon: Sym(MSym.personAdd, color: c.primary),
            onPressed: () => _showForm(),
            tooltip: 'Add lead',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetch,
        child: CustomScrollView(
          slivers: [
            if (_followUpTodayCount > 0)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: TW.amber500.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: TW.amber500.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        Sym(MSym.alarm, size: 18, color: TW.amber600),
                        const SizedBox(width: 8),
                        Text('$_followUpTodayCount follow-up${_followUpTodayCount > 1 ? 's' : ''} due today',
                            style: KText.bodyMd
                                .copyWith(color: TW.amber700, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: TextField(
                  controller: _searchCtrl,
                  decoration: InputDecoration(
                    hintText: 'Search leads…',
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
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  itemCount: _statuses.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) => FilterChip(
                    label: Text(_statuses[i]),
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
                  icon: MSym.personSearch,
                  message: _search.isNotEmpty ? 'No leads found' : 'No leads yet',
                  action: _search.isEmpty
                      ? TextButton.icon(
                          onPressed: () => _showForm(),
                          icon: const Icon(Icons.add),
                          label: const Text('Add Lead'),
                        )
                      : null,
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => _LeadCard(
                      lead: filtered[i],
                      isFollowUpToday: _followUpToday(filtered[i]),
                      onEdit: () => _showForm(filtered[i]),
                      onDelete: () => _delete(filtered[i]),
                      onConvert: () => _convertToMember(filtered[i]),
                      onWhatsApp: (filtered[i]['phone'] as String?)?.isNotEmpty == true
                          ? () => showWhatsAppSheet(
                                context,
                                phone: filtered[i]['phone'],
                                defaultMessage:
                                    'Hi ${filtered[i]['name']}, thanks for your interest in our gym! We\'d love to have you join us.',
                                recipientLabel: filtered[i]['name'] ?? '',
                              )
                          : null,
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

class _LeadCard extends StatelessWidget {
  final Map<String, dynamic> lead;
  final bool isFollowUpToday;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onConvert;
  final VoidCallback? onWhatsApp;
  const _LeadCard({
    required this.lead,
    required this.isFollowUpToday,
    required this.onEdit,
    required this.onDelete,
    required this.onConvert,
    this.onWhatsApp,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final status = lead['status'] as String? ?? 'New';
    final statusColor = _statusColor[status] ?? TW.slate500;
    final name = lead['name'] as String? ?? '';
    final phone = lead['phone'] as String? ?? '';
    final source = lead['source'] as String? ?? '';
    final followUp = lead['nextFollowUp'] as String? ?? '';
    final canConvert = status == 'Won' || status == 'Interested';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: KCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (isFollowUpToday)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: TW.amber500.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  children: [
                    Sym(MSym.alarm, size: 14, color: TW.amber600),
                    const SizedBox(width: 4),
                    Text('Follow-up today',
                        style: const TextStyle(
                            color: TW.amber700,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            fontFamily: 'PlusJakartaSans')),
                  ],
                ),
              ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                InitialAvatar(
                    name: name,
                    size: 44,
                    bg: statusColor.withValues(alpha: 0.12),
                    fg: statusColor),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(name,
                                style: KText.bodyLg.copyWith(
                                    color: c.onSurface, fontWeight: FontWeight.w600)),
                          ),
                          Pill(status, bg: statusColor.withValues(alpha: 0.1), fg: statusColor,
                              dot: true),
                        ],
                      ),
                      if (phone.isNotEmpty)
                        Text(phone, style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                      Wrap(spacing: 8, children: [
                        if (source.isNotEmpty)
                          Pill(source, bg: TW.slate200, fg: TW.slate500),
                        if (followUp.isNotEmpty)
                          Text('Follow-up: ${fmtDate(followUp)}',
                              style: KText.bodyMd.copyWith(
                                  color: isFollowUpToday ? TW.amber600 : c.onSurfaceVariant)),
                      ]),
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
            if (canConvert || onWhatsApp != null) ...[
              const SizedBox(height: 8),
              Row(children: [
                if (onWhatsApp != null)
                  OutlinedButton.icon(
                    onPressed: onWhatsApp,
                    icon: Sym(MSym.chat, size: 16, color: TW.whatsapp),
                    label: const Text('WhatsApp'),
                    style: OutlinedButton.styleFrom(
                        foregroundColor: TW.whatsapp,
                        side: const BorderSide(color: TW.whatsapp)),
                  ),
                if (canConvert) ...[
                  if (onWhatsApp != null) const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: onConvert,
                      icon: Sym(MSym.personAdd, size: 16, color: Colors.white),
                      label: const Text('Convert to Member'),
                      style: FilledButton.styleFrom(backgroundColor: TW.emerald600),
                    ),
                  ),
                ],
              ]),
            ],
          ],
        ),
      ),
    );
  }
}

class _LeadForm extends StatefulWidget {
  final Map<String, dynamic>? lead;
  final String gymId;
  final VoidCallback onSaved;
  const _LeadForm({this.lead, required this.gymId, required this.onSaved});

  @override
  State<_LeadForm> createState() => _LeadFormState();
}

class _LeadFormState extends State<_LeadForm> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _planCtrl = TextEditingController();
  final _budgetCtrl = TextEditingController();
  String _status = 'New';
  String _source = 'Walk-in';
  String _followUpDate = '';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final l = widget.lead;
    if (l != null) {
      _nameCtrl.text = l['name'] ?? '';
      _phoneCtrl.text = l['phone'] ?? '';
      _emailCtrl.text = l['email'] ?? '';
      _planCtrl.text = l['interestedPlan'] ?? '';
      _budgetCtrl.text = asNum(l['budget']) == 0 ? '' : asNum(l['budget']).toString();
      _status = l['status'] ?? 'New';
      _source = l['source'] ?? 'Walk-in';
      _followUpDate = l['nextFollowUp'] ?? '';
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _planCtrl.dispose();
    _budgetCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickFollowUp() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _followUpDate.isNotEmpty
          ? DateTime.tryParse(_followUpDate) ?? DateTime.now()
          : DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (d != null) setState(() => _followUpDate = d.toIso8601String().split('T').first);
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);
    final data = {
      'name': _nameCtrl.text.trim(),
      'phone': _phoneCtrl.text.trim(),
      'email': _emailCtrl.text.trim(),
      'status': _status,
      'source': _source,
      'interestedPlan': _planCtrl.text.trim(),
      'budget': num.tryParse(_budgetCtrl.text) ?? 0,
      'nextFollowUp': _followUpDate,
    };
    try {
      if (widget.lead != null) {
        await TenantDb.updateDocument(widget.gymId, 'leads', widget.lead!['id'], data);
      } else {
        await TenantDb.createDocument(widget.gymId, 'leads', data);
      }
      if (mounted) Navigator.pop(context);
      widget.onSaved();
    } catch (_) {}
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isEdit = widget.lead != null;

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
                Text(isEdit ? 'Edit Lead' : 'Add Lead',
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
                  const InputDecoration(labelText: 'Name *', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration:
                      const InputDecoration(labelText: 'Phone', border: OutlineInputBorder()),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration:
                      const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
                ),
              ),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _status,
                  decoration:
                      const InputDecoration(labelText: 'Status', border: OutlineInputBorder()),
                  items: _statuses
                      .skip(1)
                      .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                      .toList(),
                  onChanged: (v) => setState(() => _status = v!),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _source,
                  decoration:
                      const InputDecoration(labelText: 'Source', border: OutlineInputBorder()),
                  items: _sources
                      .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                      .toList(),
                  onChanged: (v) => setState(() => _source = v!),
                ),
              ),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _planCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Interested Plan', border: OutlineInputBorder()),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _budgetCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: 'Budget (₹)', border: OutlineInputBorder()),
                ),
              ),
            ]),
            const SizedBox(height: 12),
            InkWell(
              onTap: _pickFollowUp,
              child: InputDecorator(
                decoration: const InputDecoration(
                    labelText: 'Next Follow-up Date', border: OutlineInputBorder()),
                child: Text(
                    _followUpDate.isEmpty ? 'Tap to set' : fmtDate(_followUpDate),
                    style: KText.bodyMd.copyWith(
                        color: _followUpDate.isEmpty ? TW.slate400 : c.onSurface)),
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
                    : Text(isEdit ? 'Save Changes' : 'Add Lead'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
