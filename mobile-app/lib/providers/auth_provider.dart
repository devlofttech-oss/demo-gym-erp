import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/tenant_db.dart';

class Branch {
  final String id;
  final String name;
  const Branch(this.id, this.name);
}

/// Mirrors the web app's AuthContext: resolves role, active gym, and branches
/// from `users/{uid}` + `gyms/{id}` on sign-in.
class AuthProvider extends ChangeNotifier {
  final _auth = FirebaseAuth.instance;

  User? currentUser;
  String? role; // 'admin' | 'staff' | 'superadmin'
  String userName = '';
  String? gymId; // active branch
  Map<String, dynamic>? gymData;
  List<String> gymIds = [];
  List<Branch> gymBranches = [];
  bool isSuperAdmin = false;
  bool loading = true;
  bool inactiveGymError = false;

  /// Mirrors web's isPlanBlocked: the plan has not started yet, or has run out.
  /// The session stays alive so an admin can still reach the subscription
  /// screen and pay — signing them out would lock them away from renewing.
  bool isPlanBlocked = false;
  String? planBlockReason; // 'plan_not_started' | 'plan_expired'

  AuthProvider() {
    _auth.authStateChanges().listen(_onAuthChanged);
  }

  bool get isMultiBranch => gymIds.length > 1;
  String get gymName => (gymData?['name'] as String?) ?? 'Kilos';

  Future<void> _onAuthChanged(User? user) async {
    currentUser = user;
    if (user == null) {
      role = null;
      userName = '';
      gymId = null;
      gymData = null;
      gymIds = [];
      gymBranches = [];
      isSuperAdmin = false;
      isPlanBlocked = false;
      planBlockReason = null;
      loading = false;
      notifyListeners();
      return;
    }
    // Resolving role, gym and branches takes several reads. Report busy for the
    // duration so the gate holds its spinner instead of dropping back to the
    // landing screen while an already-signed-in user is still being resolved.
    loading = true;
    notifyListeners();
    try {
      final userDoc = await TenantDb.getTopDocument('users', user.uid);
      if (userDoc == null || userDoc['role'] == 'deleted') {
        inactiveGymError = true;
        await _auth.signOut();
        return;
      }
      final userRole = (userDoc['role'] as String?) ?? 'admin';

      if (userRole == 'superadmin') {
        role = 'superadmin';
        isSuperAdmin = true;
        isPlanBlocked = false;
        planBlockReason = null;
        gymId = null;
        gymIds = [];
        gymBranches = [];
        gymData = null;
        userName = (userDoc['name'] as String?) ?? 'Super Admin';
      } else {
        final primaryGymId = userDoc['gymId'] as String?;
        final storedIds = (userDoc['gymIds'] as List?)?.cast<String>();
        final allGymIds = (storedIds != null && storedIds.isNotEmpty)
            ? storedIds
            : (primaryGymId != null ? [primaryGymId] : <String>[]);
        gymIds = allGymIds;

        final prefs = await SharedPreferences.getInstance();
        final saved = prefs.getString('activeBranch_${user.uid}');
        final resolvedActiveId = (saved != null && allGymIds.contains(saved))
            ? saved
            : (allGymIds.isNotEmpty ? allGymIds.first : null);
        gymId = resolvedActiveId;

        if (allGymIds.isNotEmpty) {
          final docs = await Future.wait(
            allGymIds.map((id) => TenantDb.getTopDocument('gyms', id)),
          );
          gymBranches = [
            for (var i = 0; i < allGymIds.length; i++)
              Branch(
                allGymIds[i],
                (docs[i]?['name'] as String?) ?? 'Branch ${i + 1}',
              ),
          ];
          final activeIdx = allGymIds.indexOf(resolvedActiveId ?? '');
          final activeGym = activeIdx >= 0 ? docs[activeIdx] : docs.first;
          if (activeGym == null || activeGym['isActive'] == false) {
            inactiveGymError = true;
            await _auth.signOut();
            return;
          }
          gymData = activeGym;
          inactiveGymError = false;
          _applyPlanWindow(activeGym);
        }
        role = userRole;
        userName =
            (userDoc['name'] as String?) ??
            user.displayName ??
            user.email?.split('@').first ??
            '';
        isSuperAdmin = false;
      }
    } catch (_) {
      role = 'admin';
      userName = user.displayName ?? user.email?.split('@').first ?? '';
    }
    loading = false;
    notifyListeners();
  }

  void _applyPlanWindow(Map<String, dynamic> gym) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    var blocked = false;
    String? reason;

    final startRaw = gym['planStartDate'] as String?;
    if (startRaw != null && startRaw.isNotEmpty) {
      final start = DateTime.tryParse(startRaw);
      if (start != null &&
          today.isBefore(DateTime(start.year, start.month, start.day))) {
        blocked = true;
        reason = 'plan_not_started';
      }
    }

    if (!blocked) {
      final endRaw = gym['planEndDate'] as String?;
      if (endRaw != null && endRaw.isNotEmpty) {
        final end = DateTime.tryParse(endRaw);
        if (end != null &&
            today.isAfter(DateTime(end.year, end.month, end.day))) {
          blocked = true;
          reason = 'plan_expired';
        }
      }
    }

    isPlanBlocked = blocked;
    planBlockReason = blocked ? reason : null;
  }

  Future<void> login(String email, String password) async {
    inactiveGymError = false;
    await _auth.signInWithEmailAndPassword(email: email, password: password);
  }

  /// Re-reads the active gym doc. Called after a subscription payment lands so
  /// planEndDate updates without making the user sign out and back in.
  Future<void> refreshGym() async {
    final id = gymId;
    if (id == null) return;
    final fresh = await TenantDb.getTopDocument('gyms', id);
    if (fresh == null) return;
    gymData = fresh;
    if (!isSuperAdmin) _applyPlanWindow(fresh);
    notifyListeners();
  }

  Future<void> logout() => _auth.signOut();

  Future<bool> addBranch(String name) async {
    final user = currentUser;
    if (user == null || gymIds.length >= 3) return false;
    try {
      final newGym = await TenantDb.createRootDocument('gyms', {
        'name': name.trim(),
        'isActive': true,
        'ownerUid': user.uid,
      });
      final newId = newGym['id'] as String;
      final updatedIds = [...gymIds, newId];
      await TenantDb.updateRootDocument('users', user.uid, {
        'gymIds': updatedIds,
      });
      await TenantDb.setRootDocument('gyms/$newId/settings', 'general', {
        'gymInfo': {
          'name': name.trim(),
          'location': '',
          'contact': '',
          'email': '',
          'website': '',
          'gstNumber': '',
          'openingHours': '',
          'instagram': '',
        },
      });
      gymIds = updatedIds;
      gymBranches = [...gymBranches, Branch(newId, name.trim())];
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> switchBranch(String newGymId) async {
    if (!gymIds.contains(newGymId) || newGymId == gymId) return;
    final prefs = await SharedPreferences.getInstance();
    if (currentUser != null) {
      await prefs.setString('activeBranch_${currentUser!.uid}', newGymId);
    }
    gymId = newGymId;
    gymData = await TenantDb.getTopDocument('gyms', newGymId);
    notifyListeners();
  }
}
