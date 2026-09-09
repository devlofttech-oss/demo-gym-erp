import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' hide AuthProvider;
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

const _roles = ['All', 'Trainer', 'Staff', 'Manager', 'Receptionist'];

const _roleColor = {
  'Trainer': TW.violet600,
  'Manager': TW.blue600,
  'Receptionist': TW.emerald600,
  'Staff': TW.slate500,
};

class StaffScreen extends StatefulWidget {
  const StaffScreen({super.key});
  @override
  State<StaffScreen> createState() => _StaffScreenState();
}

class _StaffScreenState extends State<StaffScreen> {
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
      final res = await TenantDb.getCollection(gymId, 'staff');
      if (mounted) setState(() => _staff = res);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _filtered {
    var list = _staff;
    if (_tab > 0) {
      list = list.where((s) => (s['role'] ?? '') == _roles[_tab]).toList();
    }
    if (_search.isNotEmpty) {
      final term = _search.toLowerCase();
      list = list
          .where((s) =>
              ((s['name'] as String?)?.toLowerCase().contains(term) ?? false) ||
              ((s['phone'] as String?)?.contains(term) ?? false))
          .toList();
    }
    return list;
  }

  void _showForm([Map<String, dynamic>? member]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _StaffForm(
        staff: member,
        gymId: context.read<AuthProvider>().gymId ?? '',
        onSaved: _fetch,
      ),
    );
  }

  Future<void> _delete(Map<String, dynamic> s) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Remove Staff'),
        content: Text('Remove "${s['name']}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: TW.rose600),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (ok == true && mounted) {
      await TenantDb.deleteDocument(context.read<AuthProvider>().gymId ?? '', 'staff', s['id']);
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
        title: Text('Staff', style: KText.h3.copyWith(color: c.onSurface)),
        actions: [
          IconButton(
            icon: Sym(MSym.personAdd, color: c.primary),
            onPressed: () => _showForm(),
            tooltip: 'Add staff',
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
                    hintText: 'Search staff…',
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
                  itemCount: _roles.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, i) => FilterChip(
                    label: Text(_roles[i]),
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
                  icon: MSym.badge,
                  message: _search.isNotEmpty ? 'No staff found' : 'No staff added yet',
                  action: _search.isEmpty
                      ? TextButton.icon(
                          onPressed: () => _showForm(),
                          icon: const Icon(Icons.add),
                          label: const Text('Add Staff'),
                        )
                      : null,
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => _StaffCard(
                      staff: filtered[i],
                      onEdit: () => _showForm(filtered[i]),
                      onDelete: () => _delete(filtered[i]),
                    ),
                    childCount: filtered.length,
                  ),
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                child: Text(
                  'Showing ${filtered.length} of ${_staff.length} staff member${_staff.length != 1 ? 's' : ''}',
                  style: KText.bodyMd.copyWith(color: context.c.onSurfaceVariant),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StaffCard extends StatelessWidget {
  final Map<String, dynamic> staff;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _StaffCard({required this.staff, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final role = staff['role'] as String? ?? 'Staff';
    final color = _roleColor[role] ?? TW.slate500;
    final name = staff['name'] as String? ?? '';
    final phone = staff['phone'] as String? ?? '';
    final joiningDate = staff['joiningDate'] as String?;
    final salary = asNum(staff['salary']);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: KCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InitialAvatar(name: name, size: 44, bg: color.withValues(alpha: 0.12), fg: color),
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
                      Pill(role, bg: color.withValues(alpha: 0.1), fg: color),
                    ],
                  ),
                  const SizedBox(height: 4),
                  if (phone.isNotEmpty)
                    Text(phone, style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                  Wrap(spacing: 12, children: [
                    if (joiningDate != null && joiningDate.isNotEmpty)
                      Text('Joined ${fmtDate(joiningDate)}',
                          style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                    if (salary > 0)
                      Text(rupees(salary),
                          style: KText.bodyMd.copyWith(
                              color: c.onSurface, fontWeight: FontWeight.w600)),
                    if (asNum(staff['commission']) > 0)
                      Text(
                        staff['commissionType'] == 'Fixed'
                            ? '${rupees(asNum(staff['commission']))} commission'
                            : '${asNum(staff['commission']).toStringAsFixed(0)}% commission',
                        style: KText.bodyMd.copyWith(color: c.onSurfaceVariant),
                      ),
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
                    child: Text('Remove', style: TextStyle(color: TW.rose600))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StaffForm extends StatefulWidget {
  final Map<String, dynamic>? staff;
  final String gymId;
  final VoidCallback onSaved;
  const _StaffForm({this.staff, required this.gymId, required this.onSaved});

  @override
  State<_StaffForm> createState() => _StaffFormState();
}

class _StaffFormState extends State<_StaffForm> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _salaryCtrl = TextEditingController();
  final _commissionCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _certCtrl = TextEditingController();
  // App login fields — only used when creating a new staff member
  final _loginEmailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();

  String _role = 'Trainer';
  String _commissionType = 'Percent';
  String _joiningDate = todayStr();
  bool _saving = false;
  bool _createLogin = false;
  bool _showPassword = false;

  static const _validRoles = ['Trainer', 'Staff', 'Manager', 'Receptionist'];
  static const _validCommTypes = ['Percent', 'Fixed'];

  @override
  void initState() {
    super.initState();
    final s = widget.staff;
    if (s != null) {
      _nameCtrl.text = (s['name'] as String?) ?? '';
      _phoneCtrl.text = (s['phone'] as String?) ?? '';
      _emailCtrl.text = (s['email'] as String?) ?? '';
      final salary = asNum(s['salary']);
      _salaryCtrl.text = salary == 0 ? '' : salary.toStringAsFixed(0);
      final comm = asNum(s['commission']);
      _commissionCtrl.text = comm == 0 ? '' : comm.toStringAsFixed(0);
      _addressCtrl.text = (s['address'] as String?) ?? '';
      _certCtrl.text = (s['certifications'] as List?)?.join(', ') ?? '';
      // Sanitise dropdown values so the form never crashes on unexpected data
      final storedRole = s['role'] as String? ?? '';
      _role = _validRoles.contains(storedRole) ? storedRole : 'Trainer';
      final storedCommType = s['commissionType'] as String? ?? '';
      _commissionType = _validCommTypes.contains(storedCommType) ? storedCommType : 'Percent';
      _joiningDate = (s['joiningDate'] as String?) ?? todayStr();
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _salaryCtrl.dispose();
    _commissionCtrl.dispose();
    _addressCtrl.dispose();
    _certCtrl.dispose();
    _loginEmailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_joiningDate) ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
    );
    if (d != null) setState(() => _joiningDate = d.toIso8601String().split('T').first);
  }

  // Creates a Firebase Auth user using a secondary app so the admin stays signed in.
  Future<String?> _createAuthUser(String email, String password) async {
    FirebaseApp? secondaryApp;
    try {
      secondaryApp = await Firebase.initializeApp(
        name: 'staffSetup_${email.hashCode.abs()}',
        options: Firebase.app().options,
      );
      final auth = FirebaseAuth.instanceFor(app: secondaryApp);
      final cred = await auth.createUserWithEmailAndPassword(email: email, password: password);
      return cred.user?.uid;
    } on FirebaseException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Login creation failed: ${e.message}'), backgroundColor: TW.rose600),
        );
      }
      return null;
    } finally {
      await secondaryApp?.delete();
    }
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name is required'), backgroundColor: TW.rose600),
      );
      return;
    }
    if (_createLogin) {
      if (_loginEmailCtrl.text.trim().isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Login email is required'), backgroundColor: TW.rose600),
        );
        return;
      }
      if (_passwordCtrl.text.length < 6) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Password must be at least 6 characters'), backgroundColor: TW.rose600),
        );
        return;
      }
    }
    setState(() => _saving = true);
    final data = {
      'name': _nameCtrl.text.trim(),
      'role': _role,
      'phone': _phoneCtrl.text.trim(),
      'email': _emailCtrl.text.trim(),
      'salary': num.tryParse(_salaryCtrl.text) ?? 0,
      'commission': num.tryParse(_commissionCtrl.text) ?? 0,
      'commissionType': _commissionType,
      'address': _addressCtrl.text.trim(),
      'joiningDate': _joiningDate,
      'certifications': _certCtrl.text.trim().isEmpty
          ? []
          : _certCtrl.text.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList(),
    };
    try {
      String staffDocId;
      if (widget.staff != null) {
        await TenantDb.updateDocument(widget.gymId, 'staff', widget.staff!['id'], data);
        staffDocId = widget.staff!['id'] as String;
      } else {
        final created = await TenantDb.createDocument(widget.gymId, 'staff', data);
        staffDocId = created['id'] as String;
      }

      // Create app login credentials for new staff members.
      if (_createLogin && widget.staff == null) {
        final email = _loginEmailCtrl.text.trim();
        final uid = await _createAuthUser(email, _passwordCtrl.text);
        if (uid != null && mounted) {
          // Write users/{uid} — Firestore rules allow an admin to create this
          // document for staff in their own gym (secondary app pattern).
          await FirebaseFirestore.instance.collection('users').doc(uid).set({
            'role': 'staff',
            'gymId': widget.gymId,
            'name': _nameCtrl.text.trim(),
            'email': email,
            'createdAt': FieldValue.serverTimestamp(),
            'updatedAt': FieldValue.serverTimestamp(),
          });
          // Link the auth UID back to the staff document.
          await TenantDb.updateDocument(widget.gymId, 'staff', staffDocId, {
            'uid': uid,
            'loginEmail': email,
            'hasLogin': true,
          });
        }
      }

      if (mounted) Navigator.pop(context);
      widget.onSaved();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save: $e'), backgroundColor: TW.rose600),
        );
      }
    }
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isEdit = widget.staff != null;
    final existingLogin = isEdit && widget.staff!['hasLogin'] == true;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: c.surfaceContainerLowest,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.88,
          maxChildSize: 0.95,
          minChildSize: 0.5,
          builder: (_, ctrl) => ListView(
            controller: ctrl,
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              Center(
                child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                        color: c.outlineVariant, borderRadius: BorderRadius.circular(2))),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Text(isEdit ? 'Edit Staff' : 'Add Staff',
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
                    const InputDecoration(labelText: 'Full Name *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _role,
                decoration: const InputDecoration(labelText: 'Role', border: OutlineInputBorder()),
                items: _validRoles
                    .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                    .toList(),
                onChanged: (v) => setState(() => _role = v!),
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
                  child: TextField(
                    controller: _salaryCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'Salary (₹)', border: OutlineInputBorder()),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: InkWell(
                    onTap: _pickDate,
                    child: InputDecorator(
                      decoration: const InputDecoration(
                          labelText: 'Joining Date', border: OutlineInputBorder()),
                      child: Text(fmtDate(_joiningDate),
                          style: KText.bodyMd.copyWith(color: c.onSurface)),
                    ),
                  ),
                ),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _commissionType,
                    decoration: const InputDecoration(labelText: 'Commission Type', border: OutlineInputBorder()),
                    items: const [
                      DropdownMenuItem(value: 'Percent', child: Text('Percent (%)')),
                      DropdownMenuItem(value: 'Fixed', child: Text('Fixed (₹)')),
                    ],
                    onChanged: (v) => setState(() => _commissionType = v!),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _commissionCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: _commissionType == 'Percent' ? 'Commission %' : 'Commission (₹)',
                      border: const OutlineInputBorder(),
                    ),
                  ),
                ),
              ]),
              const SizedBox(height: 12),
              TextField(
                controller: _addressCtrl,
                maxLines: 2,
                decoration:
                    const InputDecoration(labelText: 'Address', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _certCtrl,
                decoration: const InputDecoration(
                  labelText: 'Certifications (comma-separated)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 20),

              // ── App Login ────────────────────────────────────────────────
              if (existingLogin) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: TW.emerald600.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: TW.emerald600.withValues(alpha: 0.25)),
                  ),
                  child: Row(children: [
                    const Sym(MSym.checkCircle, size: 18, color: TW.emerald600),
                    const SizedBox(width: 10),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('App login active', style: KText.bodyMd.copyWith(color: TW.emerald700, fontWeight: FontWeight.w600)),
                      Text(widget.staff!['loginEmail'] as String? ?? '', style: KText.bodyMd.copyWith(color: c.onSurfaceVariant, fontSize: 12)),
                    ])),
                  ]),
                ),
                const SizedBox(height: 16),
              ] else if (!isEdit) ...[
                // Create login option for new staff
                InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () => setState(() => _createLogin = !_createLogin),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _createLogin
                          ? c.primary.withValues(alpha: 0.08)
                          : c.surfaceContainer,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: _createLogin
                            ? c.primary.withValues(alpha: 0.4)
                            : c.outlineVariant.withValues(alpha: 0.4),
                      ),
                    ),
                    child: Row(children: [
                      Sym(
                        _createLogin ? MSym.checkCircle : MSym.lock,
                        size: 18,
                        color: _createLogin ? c.primary : c.onSurfaceVariant,
                      ),
                      const SizedBox(width: 10),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Create app login', style: KText.bodyMd.copyWith(
                          color: _createLogin ? c.primary : c.onSurface,
                          fontWeight: FontWeight.w600,
                        )),
                        Text('Staff can sign in to the mobile app', style: KText.bodyMd.copyWith(
                          color: c.onSurfaceVariant,
                          fontSize: 12,
                        )),
                      ])),
                    ]),
                  ),
                ),
                if (_createLogin) ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: _loginEmailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Login Email *',
                      border: OutlineInputBorder(),
                      helperText: 'Staff will use this to sign in',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _passwordCtrl,
                    obscureText: !_showPassword,
                    decoration: InputDecoration(
                      labelText: 'Password * (min 6 chars)',
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        icon: Sym(_showPassword ? MSym.visibilityOff : MSym.visibility, size: 20, color: c.onSurfaceVariant),
                        onPressed: () => setState(() => _showPassword = !_showPassword),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
              ],

              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(isEdit ? 'Save Changes' : 'Add Staff'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
