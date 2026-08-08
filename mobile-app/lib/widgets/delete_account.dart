import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../theme/app_icons.dart';
import '../theme/app_theme.dart';
import 'common.dart';

/// In-app account deletion — required for Play/App Store apps with logins.
/// Deletes the user's Firestore profile doc and their Firebase Auth account.
/// Handles Firebase's "requires-recent-login" by re-authenticating with the
/// password. Gym business records are intentionally NOT deleted here (they
/// belong to the gym, not the individual account) — see the web deletion page.
Future<void> showDeleteAccountDialog(BuildContext context) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: ctx.c.surfaceContainerLowest,
      icon: const Sym(MSym.warning, size: 36, color: TW.rose500, fill: true),
      title: Text('Delete account', style: TextStyle(color: ctx.c.onSurface)),
      content: Text(
        'This permanently deletes your Kilos login and personal profile. '
        'It cannot be undone.\n\n'
        "Your gym's records (members, payments) are not deleted here — "
        'contact support to remove all gym data.',
        style: TextStyle(color: ctx.c.onSurfaceVariant),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: TW.rose600, foregroundColor: Colors.white),
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('Delete'),
        ),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) return;
  await _delete(context, password: null);
}

Future<void> _delete(BuildContext context, {required String? password}) async {
  final messenger = ScaffoldMessenger.of(context);
  _showLoading(context);
  try {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    if (password != null && user.email != null) {
      final cred = EmailAuthProvider.credential(email: user.email!, password: password);
      await user.reauthenticateWithCredential(cred);
    }

    // Best-effort profile doc removal, then the auth account itself.
    try {
      await FirebaseFirestore.instance.collection('users').doc(user.uid).delete();
    } catch (_) {/* rules may already block; proceed to auth delete */}
    await user.delete();

    if (context.mounted) Navigator.of(context, rootNavigator: true).pop(); // close loading
    // authStateChanges now fires → AuthGate routes back to Login.
  } on FirebaseAuthException catch (e) {
    if (context.mounted) Navigator.of(context, rootNavigator: true).pop();
    if (e.code == 'requires-recent-login' && context.mounted) {
      await _reauthThenDelete(context);
    } else {
      messenger.showSnackBar(SnackBar(content: Text('Could not delete account: ${e.message ?? e.code}')));
    }
  } catch (_) {
    if (context.mounted) Navigator.of(context, rootNavigator: true).pop();
    messenger.showSnackBar(const SnackBar(content: Text('Could not delete account. Please try again.')));
  }
}

Future<void> _reauthThenDelete(BuildContext context) async {
  final pw = TextEditingController();
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: ctx.c.surfaceContainerLowest,
      title: Text('Confirm your password', style: TextStyle(color: ctx.c.onSurface)),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('For your security, re-enter your password to delete your account.',
            style: TextStyle(color: ctx.c.onSurfaceVariant, fontSize: 13)),
        const SizedBox(height: 12),
        TextField(
          controller: pw,
          obscureText: true,
          autofocus: true,
          style: TextStyle(color: ctx.c.onSurface),
          decoration: InputDecoration(
            hintText: 'Password',
            filled: true,
            fillColor: ctx.c.surfaceContainer,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
          ),
        ),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: TW.rose600, foregroundColor: Colors.white),
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('Delete'),
        ),
      ],
    ),
  );
  if (ok != true || !context.mounted) return;
  await _delete(context, password: pw.text);
}

void _showLoading(BuildContext context) {
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (_) => const Center(child: KSpinner(size: 40)),
  );
}
