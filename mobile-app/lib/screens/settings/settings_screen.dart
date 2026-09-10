import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  // Gym Info
  final _gymName = TextEditingController();
  final _address = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _workingHours = TextEditingController();
  final _gracePeriod = TextEditingController();
  final _gstNumber = TextEditingController();
  final _website = TextEditingController();
  final _instagram = TextEditingController();

  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void dispose() {
    for (final c in [
      _gymName, _address, _phone, _email, _workingHours, _gracePeriod,
      _gstNumber, _website, _instagram,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _fetch() async {
    final gymId = context.read<AuthProvider>().gymId;
    if (gymId == null || gymId.isEmpty) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    if (mounted) setState(() => _loading = true);
    try {
      final doc = await TenantDb.getTopDocument('gyms', gymId);
      if (doc != null && mounted) {
        setState(() {
          _gymName.text = doc['name'] ?? '';
          _address.text = doc['address'] ?? '';
          _phone.text = doc['phone'] ?? '';
          _email.text = doc['email'] ?? '';
          _workingHours.text = doc['workingHours'] ?? '';
          _gracePeriod.text = (doc['gracePeriodDays'] ?? 0).toString();
          _gstNumber.text = doc['gstNumber'] ?? '';
          _website.text = doc['website'] ?? '';
          _instagram.text = doc['instagram'] ?? '';

        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _save() async {
    final gymId = context.read<AuthProvider>().gymId;
    if (gymId == null || gymId.isEmpty) return;
    setState(() => _saving = true);
    final data = {
      'name': _gymName.text.trim(),
      'address': _address.text.trim(),
      'phone': _phone.text.trim(),
      'email': _email.text.trim(),
      'workingHours': _workingHours.text.trim(),
      'gracePeriodDays': int.tryParse(_gracePeriod.text) ?? 0,
      'gstNumber': _gstNumber.text.trim(),
      'website': _website.text.trim(),
      'instagram': _instagram.text.trim(),
    };
    try {
      await TenantDb.updateDocument('', 'gyms', gymId, data);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Settings saved'), backgroundColor: TW.emerald600),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save: $e'), backgroundColor: TW.rose600),
        );
      }
    }
    if (mounted) setState(() => _saving = false);
  }

  Future<void> _addBranchDialog() async {
    final ctrl = TextEditingController();
    final auth = context.read<AuthProvider>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add New Branch'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Branch Name *',
            hintText: 'e.g. Koramangala, Indiranagar…',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Create'),
          ),
        ],
      ),
    );
    if (ok == true && ctrl.text.trim().isNotEmpty && mounted) {
      final success = await auth.addBranch(ctrl.text.trim());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(success
              ? 'Branch "${ctrl.text.trim()}" created!'
              : 'Failed to create branch.'),
          backgroundColor: success ? TW.emerald600 : TW.rose600,
        ));
      }
    }
    ctrl.dispose();
  }

  Widget _section(String title) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 20, 0, 10),
      child: Text(title, style: KText.labelCaps.copyWith(color: c.onSurfaceVariant)),
    );
  }

  Widget _field(String label, TextEditingController ctrl,
      {TextInputType? type,
      int maxLines = 1,
      bool obscure = false,
      VoidCallback? toggleObscure,
      bool isObscured = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: ctrl,
        keyboardType: type,
        maxLines: maxLines,
        obscureText: obscure,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          isDense: true,
          suffixIcon: toggleObscure != null
              ? IconButton(
                  icon: Icon(isObscured ? Icons.visibility_off : Icons.visibility,
                      size: 20),
                  onPressed: toggleObscure,
                )
              : null,
        ),
      ),
    );
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
        title: Text('Settings', style: KText.h3.copyWith(color: c.onSurface)),
        actions: [
          if (!_loading)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Save'),
              ),
            ),
        ],
      ),
      body: _loading
          ? const KLoading()
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
              children: [
                _section('Appearance'),
                KCard(
                  child: Consumer<ThemeProvider>(
                    builder: (_, tp, _) => SwitchListTile(
                      value: tp.isDark,
                      onChanged: (v) => tp.setDark(v),
                      title: Text('Dark Mode', style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w500)),
                      subtitle: Text(tp.isDark ? 'Dark theme active' : 'Light theme active',
                          style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
                      secondary: Container(
                        width: 36, height: 36,
                        decoration: BoxDecoration(
                          color: tp.isDark ? const Color(0xFF1E1B2E) : c.surfaceContainerHigh,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Sym(tp.isDark ? MSym.darkMode : MSym.lightMode, size: 18,
                            color: tp.isDark ? const Color(0xFFB2A4FF) : TW.amber600),
                      ),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ),
                _section('Gym Information'),
                KCard(
                  child: Column(
                    children: [
                      _field('Gym Name', _gymName),
                      _field('Address', _address, maxLines: 2),
                      _field('Phone', _phone, type: TextInputType.phone),
                      _field('Email', _email, type: TextInputType.emailAddress),
                      _field('Working Hours (e.g. 6 AM – 10 PM)', _workingHours),
                      _field('Grace Period (days)', _gracePeriod,
                          type: TextInputType.number),
                      _field('GST Number', _gstNumber),
                      _field('Website', _website, type: TextInputType.url),
                      _field('Instagram Handle (e.g. @gymname)', _instagram),
                    ],
                  ),
                ),
                if (context.read<AuthProvider>().role == 'admin') ...[
                  _section('Branches'),
                  Builder(builder: (ctx) {
                    final auth = ctx.watch<AuthProvider>();
                    final atLimit = auth.gymBranches.length >= 3;
                    return KCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Expanded(
                              child: Text(
                                atLimit
                                    ? '${auth.gymBranches.length}/3 branches — maximum reached'
                                    : '${auth.gymBranches.length}/3 branches',
                                style: TextStyle(color: c.onSurfaceVariant, fontSize: 13),
                              ),
                            ),
                            if (!atLimit)
                              TextButton.icon(
                                onPressed: _addBranchDialog,
                                icon: const Icon(Icons.add, size: 16),
                                label: const Text('Add Branch'),
                              ),
                          ]),
                          const SizedBox(height: 8),
                          ...auth.gymBranches.asMap().entries.map((e) {
                            final idx = e.key;
                            final branch = e.value;
                            final isActive = branch.id == auth.gymId;
                            return Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: isActive ? KD.primaryTint : c.surfaceContainerLow,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: isActive ? KD.primary.withValues(alpha: 0.3) : c.outlineVariant.withValues(alpha: 0.3)),
                              ),
                              child: Row(children: [
                                Container(
                                  width: 32, height: 32,
                                  decoration: BoxDecoration(
                                    color: isActive ? KD.primary : c.surfaceContainerHigh,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Center(
                                    child: Text('${idx + 1}',
                                        style: TextStyle(
                                            color: isActive ? Colors.white : c.onSurfaceVariant,
                                            fontWeight: FontWeight.w700,
                                            fontSize: 13)),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(branch.name,
                                        style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w600, fontSize: 14)),
                                    if (isActive)
                                      Text('Currently viewing',
                                          style: TextStyle(color: KD.primary, fontSize: 11, fontWeight: FontWeight.w500)),
                                  ],
                                )),
                                if (!isActive)
                                  OutlinedButton(
                                    onPressed: () => auth.switchBranch(branch.id),
                                    style: OutlinedButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                        minimumSize: Size.zero,
                                        tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                                    child: const Text('Switch', style: TextStyle(fontSize: 12)),
                                  ),
                              ]),
                            );
                          }),
                        ],
                      ),
                    );
                  }),
                ],
              ],
            ),
    );
  }
}
