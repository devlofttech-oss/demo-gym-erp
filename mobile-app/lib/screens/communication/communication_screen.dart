import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

const _groupOptions = [
  _MemberGroup('All Active', 'active', MSym.group),
  _MemberGroup('Expiring (7 days)', 'expiring7', MSym.alarm),
  _MemberGroup('Expiring (30 days)', 'expiring30', MSym.calendarMonth),
  _MemberGroup('Expired', 'expired', MSym.eventBusy),
  _MemberGroup('Frozen', 'frozen', MSym.pauseCircle),
];

class _MemberGroup {
  final String label;
  final String key;
  final IconData icon;
  const _MemberGroup(this.label, this.key, this.icon);
}

const _templates = [
  _Template('Expiry Reminder',
      'Hi {{name}}, your Kilos membership expires on {{expiry}}. Renew today to continue your fitness journey! 💪'),
  _Template('Payment Due',
      'Hi {{name}}, you have an outstanding balance with Kilos Gym. Please clear your dues at your earliest convenience.'),
  _Template('Welcome',
      'Welcome to Kilos Gym, {{name}}! 🎉 We\'re excited to have you join our fitness family. See you at the gym!'),
  _Template('Announcement',
      'Hi {{name}}, we have an exciting announcement from Kilos Gym. Stay tuned for more updates!'),
];

class _Template {
  final String title;
  final String body;
  const _Template(this.title, this.body);
}

class CommunicationScreen extends StatefulWidget {
  const CommunicationScreen({super.key});
  @override
  State<CommunicationScreen> createState() => _CommunicationScreenState();
}

class _CommunicationScreenState extends State<CommunicationScreen> {
  List<Map<String, dynamic>> _allMembers = [];
  List<Map<String, dynamic>> _filtered = [];
  Map<String, dynamic>? _gymSettings;
  bool _loading = true;
  bool _sending = false;
  int _groupIndex = 0;
  final _msgCtrl = TextEditingController();
  final Set<String> _selected = {};

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void dispose() {
    _msgCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    final gymId = context.read<AuthProvider>().gymId;
    if (mounted) setState(() => _loading = true);
    try {
      final res = await Future.wait([
        TenantDb.getCollection(gymId, 'members'),
        gymId != null && gymId.isNotEmpty
            ? TenantDb.getTopDocument('gyms', gymId)
            : Future.value(null),
      ]);
      if (mounted) {
        _allMembers = res[0] as List<Map<String, dynamic>>;
        _gymSettings = res[1] as Map<String, dynamic>?;
        _applyGroup();
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  void _applyGroup() {
    final group = _groupOptions[_groupIndex];
    List<Map<String, dynamic>> list;
    switch (group.key) {
      case 'expiring7':
        list = _allMembers.where((m) {
          final days = daysUntilExpiry(m['expiryDate'] as String?);
          return days != null && days >= 0 && days <= 7;
        }).toList();
        break;
      case 'expiring30':
        list = _allMembers.where((m) {
          final days = daysUntilExpiry(m['expiryDate'] as String?);
          return days != null && days >= 0 && days <= 30;
        }).toList();
        break;
      case 'expired':
        list = _allMembers.where((m) {
          final days = daysUntilExpiry(m['expiryDate'] as String?);
          return days != null && days < 0;
        }).toList();
        break;
      case 'frozen':
        list = _allMembers.where((m) => m['status'] == 'Frozen').toList();
        break;
      default: // active
        list = _allMembers.where((m) => isMemberEligible(m)).toList();
    }
    setState(() {
      _filtered = list;
      _selected.clear();
      _selected.addAll(list.map((m) => m['id'] as String? ?? '').where((id) => id.isNotEmpty));
      // Set default message template
      if (_msgCtrl.text.isEmpty && _templates.isNotEmpty) {
        _msgCtrl.text = _templates[0].body;
      }
    });
  }

  String _personalise(String template, Map<String, dynamic> m) {
    return template
        .replaceAll('{{name}}', m['name'] ?? 'Member')
        .replaceAll('{{expiry}}', fmtDate(m['expiryDate']));
  }

  Future<void> _sendAll() async {
    final recipients = _filtered.where((m) => _selected.contains(m['id'])).toList();
    if (recipients.isEmpty || _msgCtrl.text.trim().isEmpty) return;

    final waToken = _gymSettings?['wapiToken'] as String? ?? '';
    final waPhoneId = _gymSettings?['wapiPhoneNumberId'] as String? ?? '';

    if (waToken.isNotEmpty && waPhoneId.isNotEmpty) {
      await _sendViaApi(recipients, waToken, waPhoneId);
    } else {
      await _sendViaLink(recipients);
    }
  }

  Future<void> _sendViaApi(
      List<Map<String, dynamic>> recipients, String token, String phoneId) async {
    setState(() => _sending = true);
    int success = 0;
    int fail = 0;
    for (final m in recipients) {
      final phone = (m['phone'] as String? ?? '').replaceAll(RegExp(r'[^\d+]'), '');
      if (phone.isEmpty) continue;
      final body = _personalise(_msgCtrl.text.trim(), m);
      try {
        final resp = await http.post(
          Uri.parse('https://graph.facebook.com/v18.0/$phoneId/messages'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'messaging_product': 'whatsapp',
            'to': phone.startsWith('+') ? phone.substring(1) : phone,
            'type': 'text',
            'text': {'body': body},
          }),
        );
        if (resp.statusCode == 200) {
          success++;
        } else {
          fail++;
        }
      } catch (_) {
        fail++;
      }
    }
    if (mounted) {
      setState(() => _sending = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Sent: $success, Failed: $fail'),
        backgroundColor: fail == 0 ? TW.emerald600 : TW.amber600,
      ));
    }
  }

  Future<void> _sendViaLink(List<Map<String, dynamic>> recipients) async {
    for (final m in recipients) {
      final phone = (m['phone'] as String? ?? '').replaceAll(RegExp(r'[^\d]'), '');
      if (phone.isEmpty) continue;
      final body = _personalise(_msgCtrl.text.trim(), m);
      final url = Uri.parse('https://wa.me/91$phone?text=${Uri.encodeComponent(body)}');
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
        await Future.delayed(const Duration(milliseconds: 500));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final hasApi = (_gymSettings?['wapiToken'] as String? ?? '').isNotEmpty;
    final selectedCount = _filtered.where((m) => _selected.contains(m['id'])).length;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        leading: IconButton(
          icon: Sym(MSym.arrowBack, size: 20, color: c.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Communication', style: KText.h3.copyWith(color: c.onSurface)),
      ),
      body: _loading
          ? const KLoading()
          : Column(
              children: [
                // Group chips
                SizedBox(
                  height: 52,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: _groupOptions.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, i) => FilterChip(
                      avatar: Sym(_groupOptions[i].icon, size: 14,
                          color: _groupIndex == i ? c.primary : TW.slate500),
                      label: Text(_groupOptions[i].label),
                      selected: _groupIndex == i,
                      onSelected: (_) {
                        setState(() => _groupIndex = i);
                        _applyGroup();
                      },
                      showCheckmark: false,
                    ),
                  ),
                ),
                // Message composer
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Template buttons
                      SizedBox(
                        height: 36,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _templates.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 6),
                          itemBuilder: (_, i) => OutlinedButton(
                            onPressed: () =>
                                setState(() => _msgCtrl.text = _templates[i].body),
                            style: OutlinedButton.styleFrom(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 10),
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                            child: Text(_templates[i].title, style: const TextStyle(fontSize: 12)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _msgCtrl,
                        maxLines: 4,
                        decoration: InputDecoration(
                          hintText: 'Type your message… use {{name}} for personalization',
                          border: const OutlineInputBorder(),
                          isDense: true,
                          suffixIcon: Padding(
                            padding: const EdgeInsets.only(right: 8, bottom: 4),
                            child: Align(
                              alignment: Alignment.bottomRight,
                              child: Text(
                                '{{name}} · {{expiry}}',
                                style: TextStyle(
                                    fontSize: 10, color: c.onSurfaceVariant),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('$selectedCount / ${_filtered.length} selected',
                                    style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                                if (!hasApi)
                                  Text('No API key → will open WhatsApp per recipient',
                                      style: KText.bodyMd.copyWith(
                                          color: TW.amber600, fontSize: 11)),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          FilledButton.icon(
                            onPressed: (_sending || selectedCount == 0)
                                ? null
                                : _sendAll,
                            icon: _sending
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: Colors.white))
                                : Sym(MSym.sms, size: 18, color: Colors.white),
                            label: Text(_sending ? 'Sending…' : 'Send All'),
                            style: FilledButton.styleFrom(
                                backgroundColor: TW.whatsapp),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                // Recipients list
                Expanded(
                  child: _filtered.isEmpty
                      ? KEmpty(icon: MSym.group, message: 'No members in this group')
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          itemCount: _filtered.length,
                          itemBuilder: (_, i) {
                            final m = _filtered[i];
                            final id = m['id'] as String? ?? '';
                            final sel = _selected.contains(id);
                            final phone = m['phone'] as String? ?? '';
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: InitialAvatar(
                                  name: m['name'] as String?,
                                  size: 36,
                                  bg: c.primaryContainer,
                                  fg: c.primary),
                              title: Text(m['name'] ?? '',
                                  style: KText.bodyMd.copyWith(
                                      color: c.onSurface,
                                      fontWeight: FontWeight.w600)),
                              subtitle: Text(phone,
                                  style: KText.bodyMd
                                      .copyWith(color: c.onSurfaceVariant)),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (phone.isNotEmpty)
                                    IconButton(
                                      icon: Sym(MSym.chat,
                                          size: 18, color: TW.whatsapp),
                                      onPressed: () async {
                                        final cleanPhone = phone.replaceAll(
                                            RegExp(r'[^\d]'), '');
                                        final msg = _personalise(
                                            _msgCtrl.text.trim().isEmpty
                                                ? 'Hi ${m['name']}!'
                                                : _msgCtrl.text.trim(),
                                            m);
                                        final url = Uri.parse(
                                            'https://wa.me/91$cleanPhone?text=${Uri.encodeComponent(msg)}');
                                        if (await canLaunchUrl(url)) {
                                          await launchUrl(url,
                                              mode: LaunchMode
                                                  .externalApplication);
                                        }
                                      },
                                    ),
                                  Checkbox(
                                    value: sel,
                                    onChanged: (v) => setState(() {
                                      if (v == true) {
                                        _selected.add(id);
                                      } else {
                                        _selected.remove(id);
                                      }
                                    }),
                                  ),
                                ],
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
