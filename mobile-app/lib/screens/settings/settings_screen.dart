import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
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

  // ImageKit
  final _ikPublicKey = TextEditingController();
  final _ikUrlEndpoint = TextEditingController();

  // WhatsApp Cloud API
  final _waToken = TextEditingController();
  final _waPhoneNumberId = TextEditingController();
  final _waAccountId = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  bool _showWaToken = false;
  bool _showIkKey = false;

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
      _ikPublicKey, _ikUrlEndpoint, _waToken, _waPhoneNumberId, _waAccountId,
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
          _ikPublicKey.text = doc['imagekitPublicKey'] ?? '';
          _ikUrlEndpoint.text = doc['imagekitUrlEndpoint'] ?? '';
          _waToken.text = doc['wapiToken'] ?? '';
          _waPhoneNumberId.text = doc['wapiPhoneNumberId'] ?? '';
          _waAccountId.text = doc['wapiAccountId'] ?? '';
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
      'imagekitPublicKey': _ikPublicKey.text.trim(),
      'imagekitUrlEndpoint': _ikUrlEndpoint.text.trim(),
      'wapiToken': _waToken.text.trim(),
      'wapiPhoneNumberId': _waPhoneNumberId.text.trim(),
      'wapiAccountId': _waAccountId.text.trim(),
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
                _section('ImageKit (Photo Upload)'),
                KCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Text(
                          'Used for member profile photos. Get your keys from imagekit.io.',
                          style: KText.bodyMd.copyWith(color: c.onSurfaceVariant),
                        ),
                      ),
                      _field(
                        'Public Key',
                        _ikPublicKey,
                        obscure: !_showIkKey,
                        isObscured: !_showIkKey,
                        toggleObscure: () => setState(() => _showIkKey = !_showIkKey),
                      ),
                      _field('URL Endpoint', _ikUrlEndpoint),
                    ],
                  ),
                ),
                _section('WhatsApp Cloud API'),
                KCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Text(
                          'Used for bulk messaging via Communication Hub. Get credentials from Meta Business.',
                          style: KText.bodyMd.copyWith(color: c.onSurfaceVariant),
                        ),
                      ),
                      _field(
                        'Access Token',
                        _waToken,
                        obscure: !_showWaToken,
                        isObscured: !_showWaToken,
                        toggleObscure: () =>
                            setState(() => _showWaToken = !_showWaToken),
                      ),
                      _field('Phone Number ID', _waPhoneNumberId),
                      _field('Account ID', _waAccountId),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
