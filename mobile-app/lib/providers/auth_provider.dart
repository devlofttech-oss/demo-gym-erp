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
      loading = false;
      notifyListeners();
      return;
    }
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
              allGymIds.map((id) => TenantDb.getTopDocument('gyms', id)));
          gymBranches = [
            for (var i = 0; i < allGymIds.length; i++)
              Branch(allGymIds[i], (docs[i]?['name'] as String?) ?? 'Branch ${i + 1}')
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
        }
        role = userRole;
        userName = (userDoc['name'] as String?) ??
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
    notifyListeners();
  }

  Future<void> logout() => _auth.signOut();

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
