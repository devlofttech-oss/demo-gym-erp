import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

/// Calls the deployed WhatsApp Cloud API send endpoint — mirrors the web
/// `src/utils/whatsappApi.js`. Used ONLY for Utility templates (renewal +
/// payment); Marketing messages (class reminders, announcements) stay on free
/// wa.me links via actions.dart `openWhatsApp`.
const String _endpoint = 'https://app-kilos.devlofttech.com/api/whatsapp/send';

class WhatsAppApiResult {
  final int sent;
  final int failed;
  final String? error;
  const WhatsAppApiResult({this.sent = 0, this.failed = 0, this.error});
  bool get ok => error == null && failed == 0;
}

/// POST { gymId, type, memberIds, extra } with the caller's Firebase ID token.
/// type: 'renewal' | 'payment'
Future<WhatsAppApiResult> sendWhatsAppApi({
  required String gymId,
  required String type,
  required List<String> memberIds,
  Map<String, dynamic>? extra,
}) async {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) {
    return WhatsAppApiResult(failed: memberIds.length, error: 'You must be signed in');
  }

  try {
    final token = await user.getIdToken();
    final res = await http.post(
      Uri.parse(_endpoint),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'gymId': gymId,
        'type': type,
        'memberIds': memberIds,
        if (extra != null) 'extra': extra,
      }),
    );

    Map<String, dynamic> data = {};
    try {
      data = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {/* non-JSON body */}

    if (res.statusCode != 200) {
      return WhatsAppApiResult(
        failed: memberIds.length,
        error: data['error']?.toString() ?? 'Send failed (${res.statusCode})',
      );
    }
    return WhatsAppApiResult(
      sent: (data['sent'] as num?)?.toInt() ?? 0,
      failed: (data['failed'] as num?)?.toInt() ?? 0,
    );
  } catch (e) {
    return WhatsAppApiResult(failed: memberIds.length, error: e.toString());
  }
}
