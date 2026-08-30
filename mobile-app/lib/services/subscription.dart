/// Subscription plans, features and PhonePe checkout.
///
/// Prices are never sent from here — the app posts a `planId` and the server
/// looks the amount up in Firestore. Anything else and a decompiled build could
/// buy a year for a rupee.
library;

import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

/// Base URL of the Vercel deployment that serves /api/phonepe/*.
///
/// This is the APP host, not the marketing site: kilos.devlofttech.com is a
/// separate Vercel project from a separate repo and has no /api functions.
/// Overridable per build: --dart-define=KILOS_API_BASE=https://staging.example.com
const kApiBase = String.fromEnvironment(
  'KILOS_API_BASE',
  defaultValue: 'https://app-kilos.devlofttech.com',
);

class SubscriptionPlan {
  final String id;
  final String name;
  final int priceInr;
  final int durationDays;
  final String badge;
  final int sortOrder;

  const SubscriptionPlan({
    required this.id,
    required this.name,
    required this.priceInr,
    required this.durationDays,
    this.badge = '',
    this.sortOrder = 99,
  });

  factory SubscriptionPlan.fromDoc(String id, Map<String, dynamic> d) => SubscriptionPlan(
        id: id,
        name: (d['name'] ?? id) as String,
        priceInr: (d['priceInr'] as num?)?.toInt() ?? 0,
        durationDays: (d['durationDays'] as num?)?.toInt() ?? 0,
        badge: (d['badge'] ?? '') as String,
        sortOrder: (d['sortOrder'] as num?)?.toInt() ?? 99,
      );

  bool get isUsable => priceInr > 0 && durationDays > 0;
}

class PlanFeature {
  final String icon;
  final String label;
  final bool highlight;

  const PlanFeature({required this.icon, required this.label, this.highlight = false});

  factory PlanFeature.fromMap(Map<String, dynamic> m) => PlanFeature(
        icon: (m['icon'] ?? 'check') as String,
        label: (m['label'] ?? '') as String,
        highlight: m['highlight'] == true,
      );
}

/// Days until the gym's plan lapses. Negative once expired, null if unset.
int? daysLeft(String? planEndDate) {
  if (planEndDate == null || planEndDate.isEmpty) return null;
  final end = DateTime.tryParse(planEndDate);
  if (end == null) return null;
  final endOfDay = DateTime(end.year, end.month, end.day, 23, 59, 59);
  return endOfDay.difference(DateTime.now()).inDays;
}

class SubscriptionApi {
  static Future<Map<String, String>> _headers() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('You must be signed in');
    final token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  static Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$kApiBase$path'),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    Map<String, dynamic> data;
    try {
      data = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      data = {};
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(data['error'] ?? 'Request failed (HTTP ${res.statusCode})');
    }
    return data;
  }

  /// Starts a checkout. Returns the PhonePe hosted URL plus the order id to poll.
  static Future<({String merchantOrderId, String redirectUrl})> createOrder({
    required String gymId,
    required String planId,
  }) async {
    final d = await _post('/api/phonepe/create-order', {'gymId': gymId, 'planId': planId});
    return (
      merchantOrderId: d['merchantOrderId'] as String,
      redirectUrl: d['redirectUrl'] as String,
    );
  }

  /// Asks PhonePe what happened and applies the plan if it succeeded.
  ///
  /// Called when the app comes back to the foreground: coming back from the
  /// browser says nothing about whether money moved, so the app never assumes.
  static Future<({String state, bool applied, String? planEndDate})> checkOrder({
    required String gymId,
    required String merchantOrderId,
  }) async {
    final d = await _post('/api/phonepe/status', {
      'gymId': gymId,
      'merchantOrderId': merchantOrderId,
    });
    return (
      state: (d['state'] ?? 'PENDING') as String,
      applied: d['applied'] == true,
      planEndDate: d['planEndDate'] as String?,
    );
  }
}
