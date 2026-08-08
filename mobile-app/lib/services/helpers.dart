import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';

/// Shared business logic, ported 1:1 from the React app's inline helpers.

final _inr = NumberFormat.decimalPattern('en_IN');

/// `₹1,23,456` — Indian grouping like `toLocaleString('en-IN')`.
String rupees(num? v) => '₹${_inr.format((v ?? 0).round())}';

/// Plain grouped number, no symbol.
String grouped(num? v) => _inr.format((v ?? 0).round());

num asNum(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v;
  return num.tryParse(v.toString()) ?? 0;
}

String todayStr() => DateTime.now().toIso8601String().split('T').first;

/// Ceil((expiry - today) / day), both floored to midnight. null if no date.
int? daysUntilExpiry(String? expiryDate) {
  if (expiryDate == null || expiryDate.isEmpty) return null;
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final e = DateTime.tryParse(expiryDate);
  if (e == null) return null;
  final expiry = DateTime(e.year, e.month, e.day);
  return (expiry.difference(today).inHours / 24).ceil();
}

String addDays(String dateStr, int days) {
  final d = DateTime.parse(dateStr).add(Duration(days: days));
  return d.toIso8601String().split('T').first;
}

/// Last day of the Nth calendar month from start (mirrors addMonthsEnd).
String addMonthsEnd(String dateStr, int months) {
  final d = DateTime.parse(dateStr);
  // day 1, add months, then day 0 of following = last day of target month.
  final target = DateTime(d.year, d.month + months + 1, 0);
  return target.toIso8601String().split('T').first;
}

/// Entry eligibility from the live expiry date (not the stale status field).
bool isMemberEligible(Map<String, dynamic> m) {
  if (m['status'] == 'Frozen') return false;
  final exp = m['expiryDate'] as String?;
  if (exp != null && exp.isNotEmpty) return exp.compareTo(todayStr()) >= 0;
  return m['status'] == 'Active';
}

/// Accepts ISO strings and Firestore Timestamps; returns DateTime or null.
DateTime? toDate(dynamic v) {
  if (v == null) return null;
  if (v is Timestamp) return v.toDate();
  if (v is DateTime) return v;
  return DateTime.tryParse(v.toString());
}

/// `02 Jan 2026`
String fmtDate(dynamic v) {
  final d = toDate(v);
  if (d == null) return '—';
  return DateFormat('dd MMM yyyy').format(d);
}

/// `9:30 AM`
String fmtTime(dynamic v) {
  final d = toDate(v);
  if (d == null) return '—';
  return DateFormat('h:mm a').format(d);
}

String fmtDuration(dynamic mins) {
  final m = asNum(mins).toInt();
  if (m == 0) return '—';
  final h = m ~/ 60;
  final r = m % 60;
  return h > 0 ? '${h}h ${r}m' : '${r}m';
}

/// Record date for an attendance doc — supports date field or checkInTime/timestamp.
String? recordDate(Map<String, dynamic> a) {
  final d = a['date'];
  if (d is String && RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(d)) return d;
  final ts = a['checkInTime'] ?? a['timestamp'];
  final dt = toDate(ts);
  if (dt == null) return null;
  return dt.toIso8601String().split('T').first;
}

/// Smart pagination list: [1, '...', 4, 5, 6, '...', 10].
List<dynamic> paginationPages(int page, int total) {
  if (total <= 7) return List.generate(total, (i) => i + 1);
  final pages = <dynamic>[1];
  if (page > 3) pages.add('...');
  for (var p = (page - 1).clamp(2, total); p <= (page + 1).clamp(0, total - 1); p++) {
    pages.add(p);
  }
  if (page < total - 2) pages.add('...');
  pages.add(total);
  return pages;
}
