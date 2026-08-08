import 'package:flutter/material.dart';

import '../services/actions.dart';
import '../theme/app_icons.dart';
import '../theme/app_theme.dart';
import 'common.dart';

/// WhatsApp composer — mirrors SendSMSModal.jsx. Editable message + an "Open"
/// button that launches WhatsApp (wa.me) with the prefilled text.
Future<void> showWhatsAppSheet(
  BuildContext context, {
  required String phone,
  required String defaultMessage,
  String recipientLabel = '',
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _WhatsAppSheet(phone: phone, defaultMessage: defaultMessage, recipientLabel: recipientLabel),
  );
}

class _WhatsAppSheet extends StatefulWidget {
  final String phone;
  final String defaultMessage;
  final String recipientLabel;
  const _WhatsAppSheet({required this.phone, required this.defaultMessage, required this.recipientLabel});
  @override
  State<_WhatsAppSheet> createState() => _WhatsAppSheetState();
}

class _WhatsAppSheetState extends State<_WhatsAppSheet> {
  late final TextEditingController _ctrl = TextEditingController(text: widget.defaultMessage);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  String get _clean {
    final n = widget.phone.replaceAll(RegExp(r'\D'), '');
    return n.length > 10 ? n.substring(n.length - 10) : n;
  }

  bool get _valid => _clean.length >= 10;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
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
                decoration: BoxDecoration(color: c.primaryContainer.withValues(alpha: 0.3), shape: BoxShape.circle),
                child: Sym(MSym.chat, size: 20, color: c.primary, fill: true),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Send WhatsApp', style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w700)),
                  Text(widget.recipientLabel, style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
                ]),
              ),
              IconButton(onPressed: () => Navigator.pop(context), icon: Sym(MSym.close, size: 18, color: c.onSurfaceVariant)),
            ]),
            const SizedBox(height: 12),
            if (!_valid)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(color: TW.amber50, borderRadius: BorderRadius.circular(12), border: Border.all(color: TW.amber200)),
                child: const Text('No valid phone number found for this member.', style: TextStyle(color: TW.amber700, fontSize: 13)),
              ),
            Text('Message', style: TextStyle(color: c.onSurfaceVariant, fontSize: 14, fontWeight: FontWeight.w500)),
            const SizedBox(height: 6),
            TextField(
              controller: _ctrl,
              maxLines: 6,
              style: TextStyle(color: c.onSurface, fontSize: 14),
              decoration: InputDecoration(
                filled: true,
                fillColor: c.surfaceContainer,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: c.outlineVariant.withValues(alpha: 0.3))),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: c.outlineVariant.withValues(alpha: 0.3))),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: TW.whatsapp, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14)),
                onPressed: !_valid || _ctrl.text.trim().isEmpty
                    ? null
                    : () {
                        openWhatsApp(widget.phone, _ctrl.text);
                        Navigator.pop(context);
                      },
                icon: const Icon(Icons.chat, size: 18),
                label: Text('Open WhatsApp · +91 $_clean'),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
