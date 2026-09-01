import 'package:flutter/material.dart';

import '../services/whatsapp_api.dart';
import '../theme/app_icons.dart';
import '../theme/app_theme.dart';
import 'common.dart';

/// Confirm + send a Utility WhatsApp template via the Cloud API (renewal /
/// payment). Mirrors the web SendWhatsAppModal: read-only template preview +
/// a cost estimate + a Send button. For Marketing messages use the free
/// wa.me sheet (whatsapp_sheet.dart) instead.
Future<void> showWhatsAppApiSheet(
  BuildContext context, {
  required String gymId,
  required String gymName,
  required String type, // 'renewal' | 'payment'
  required List<Map<String, dynamic>> recipients, // each: {id, name, phone}
  Map<String, dynamic>? extra,
  String recipientLabel = '',
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _WhatsAppApiSheet(
      gymId: gymId,
      gymName: gymName,
      type: type,
      recipients: recipients,
      extra: extra,
      recipientLabel: recipientLabel,
    ),
  );
}

String _typeLabel(String type) => type == 'payment' ? 'Payment reminder' : 'Renewal reminder';

String _previewText(String type, Map<String, dynamic> m, String gym, Map<String, dynamic>? extra) {
  final name = (m['name'] as String?)?.trim().isNotEmpty == true ? m['name'] : 'there';
  if (type == 'payment') {
    final amt = extra?['amount'] ?? m['balanceFees'] ?? 0;
    return 'Hi $name, this is a payment reminder from $gym. You have a pending balance of ₹$amt. Please clear your dues at your earliest convenience.';
  }
  final date = m['expiryDate'] ?? '{date}';
  return 'Hi $name, your $gym membership is scheduled to expire on $date. Please contact us if you have any questions about your account.';
}

class _WhatsAppApiSheet extends StatefulWidget {
  final String gymId;
  final String gymName;
  final String type;
  final List<Map<String, dynamic>> recipients;
  final Map<String, dynamic>? extra;
  final String recipientLabel;
  const _WhatsAppApiSheet({
    required this.gymId,
    required this.gymName,
    required this.type,
    required this.recipients,
    required this.extra,
    required this.recipientLabel,
  });
  @override
  State<_WhatsAppApiSheet> createState() => _WhatsAppApiSheetState();
}

class _WhatsAppApiSheetState extends State<_WhatsAppApiSheet> {
  bool _sending = false;

  List<Map<String, dynamic>> get _valid => widget.recipients.where((r) {
        final id = r['id'];
        final digits = (r['phone']?.toString() ?? '').replaceAll(RegExp(r'\D'), '');
        return id != null && digits.length >= 10;
      }).toList();

  Future<void> _send() async {
    final valid = _valid;
    if (valid.isEmpty) return;
    setState(() => _sending = true);
    final res = await sendWhatsAppApi(
      gymId: widget.gymId,
      type: widget.type,
      memberIds: valid.map((r) => r['id'].toString()).toList(),
      extra: widget.extra,
    );
    if (!mounted) return;
    setState(() => _sending = false);
    Navigator.pop(context);
    final messenger = ScaffoldMessenger.of(context);
    if (res.ok) {
      messenger.showSnackBar(SnackBar(content: Text('Sent to ${res.sent} member${res.sent == 1 ? '' : 's'}')));
    } else if (res.sent > 0) {
      messenger.showSnackBar(SnackBar(content: Text('Sent ${res.sent}, failed ${res.failed}')));
    } else {
      messenger.showSnackBar(SnackBar(content: Text(res.error ?? 'Failed to send')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final valid = _valid;
    final estCost = (valid.length * 0.14).toStringAsFixed(2);
    final preview = _previewText(
      widget.type,
      widget.recipients.isNotEmpty ? widget.recipients.first : const {},
      widget.gymName,
      widget.extra,
    );
    return Container(
      decoration: BoxDecoration(
        color: c.surfaceContainerLowest,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(color: TW.whatsapp.withValues(alpha: 0.15), shape: BoxShape.circle),
              child: Sym(MSym.chat, size: 20, color: TW.whatsapp, fill: true),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Send ${_typeLabel(widget.type)}', style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w700)),
                Text(
                  widget.recipientLabel.isNotEmpty
                      ? widget.recipientLabel
                      : '${valid.length} recipient${valid.length == 1 ? '' : 's'} · WhatsApp',
                  style: TextStyle(color: c.onSurfaceVariant, fontSize: 12),
                ),
              ]),
            ),
            IconButton(onPressed: () => Navigator.pop(context), icon: Sym(MSym.close, size: 18, color: c.onSurfaceVariant)),
          ]),
          const SizedBox(height: 12),
          if (valid.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(color: TW.amber50, borderRadius: BorderRadius.circular(12), border: Border.all(color: TW.amber200)),
              child: const Text('No recipients with a valid phone number.', style: TextStyle(color: TW.amber700, fontSize: 13)),
            ),
          Text('Message preview', style: TextStyle(color: c.onSurfaceVariant, fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0xFFE7FFDB), borderRadius: BorderRadius.circular(12)),
            child: Text(preview, style: const TextStyle(color: Color(0xFF1E293B), fontSize: 14, height: 1.4)),
          ),
          const SizedBox(height: 6),
          Text('Sent as an approved WhatsApp template — filled in per member.',
              style: TextStyle(color: c.onSurfaceVariant, fontSize: 11)),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(color: c.surfaceContainer, borderRadius: BorderRadius.circular(12)),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('${valid.length} recipient${valid.length == 1 ? '' : 's'} · Utility', style: TextStyle(color: c.onSurfaceVariant, fontSize: 13)),
              Text('≈ ₹$estCost', style: TextStyle(color: c.onSurface, fontSize: 13, fontWeight: FontWeight.w700)),
            ]),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: TW.whatsapp, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14)),
              onPressed: _sending || valid.isEmpty ? null : _send,
              icon: _sending
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.send, size: 18),
              label: Text(_sending ? 'Sending…' : 'Send to ${valid.length}'),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
