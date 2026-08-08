import 'package:cloud_firestore/cloud_firestore.dart';

/// Multi-tenant Firestore wrapper — mirrors the web app's `tenantDb.js` /
/// `db.js`. Every collection lives under `gyms/{gymId}/{collection}`.
class TenantDb {
  TenantDb._();
  static final _db = FirebaseFirestore.instance;

  static CollectionReference<Map<String, dynamic>> _col(String gymId, String name) =>
      _db.collection('gyms').doc(gymId).collection(name);

  /// A Firestore `where` condition, mirroring `{field, op, value}` in db.js.
  static Query<Map<String, dynamic>> _applyWhere(
      Query<Map<String, dynamic>> q, List<Cond>? conditions) {
    if (conditions == null) return q;
    for (final c in conditions) {
      switch (c.op) {
        case '==':
          q = q.where(c.field, isEqualTo: c.value);
          break;
        case '>=':
          q = q.where(c.field, isGreaterThanOrEqualTo: c.value);
          break;
        case '<=':
          q = q.where(c.field, isLessThanOrEqualTo: c.value);
          break;
        case '>':
          q = q.where(c.field, isGreaterThan: c.value);
          break;
        case '<':
          q = q.where(c.field, isLessThan: c.value);
          break;
      }
    }
    return q;
  }

  /// getTenantCollection(gymId, name, conditions, sort)
  static Future<List<Map<String, dynamic>>> getCollection(
    String? gymId,
    String name, {
    List<Cond>? conditions,
    Sort? sort,
  }) async {
    if (gymId == null || gymId.isEmpty) return [];
    Query<Map<String, dynamic>> q = _col(gymId, name);
    q = _applyWhere(q, conditions);
    if (sort != null) {
      q = q.orderBy(sort.field, descending: sort.descending);
    }
    final snap = await q.get();
    return snap.docs.map((d) => {'id': d.id, ...d.data()}).toList();
  }

  static Future<Map<String, dynamic>?> getDocument(
      String? gymId, String name, String id) async {
    if (gymId == null || gymId.isEmpty) return null;
    final snap = await _col(gymId, name).doc(id).get();
    if (!snap.exists) return null;
    return {'id': snap.id, ...?snap.data()};
  }

  /// createTenantDocument — stamps createdAt/updatedAt like db.js.
  static Future<Map<String, dynamic>> createDocument(
      String gymId, String name, Map<String, dynamic> data) async {
    final payload = {
      ...data,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
    final ref = await _col(gymId, name).add(payload);
    return {'id': ref.id, ...data};
  }

  static Future<void> updateDocument(
      String gymId, String name, String id, Map<String, dynamic> data) {
    return _col(gymId, name).doc(id).update({
      ...data,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  static Future<void> deleteDocument(String gymId, String name, String id) {
    return _col(gymId, name).doc(id).delete();
  }

  /// Top-level (non-tenant) document, e.g. `users/{uid}` or `gyms/{id}`.
  static Future<Map<String, dynamic>?> getTopDocument(
      String collection, String id) async {
    final snap = await _db.collection(collection).doc(id).get();
    if (!snap.exists) return null;
    return {'id': snap.id, ...?snap.data()};
  }
}

class Cond {
  final String field;
  final String op;
  final dynamic value;
  const Cond(this.field, this.op, this.value);
}

class Sort {
  final String field;
  final bool descending;
  const Sort(this.field, {this.descending = false});
}
