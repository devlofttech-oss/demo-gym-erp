import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import 'login_screen.dart';
import 'home_shell.dart';

/// Routes on auth state — mirrors the web app's role redirect
/// (staff land on Check-in, admins on the Dashboard).
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (auth.loading) {
      return Scaffold(
        backgroundColor: context.c.background,
        body: const Center(child: KSpinner(size: 40)),
      );
    }
    if (auth.currentUser == null) return const LoginScreen();
    if (auth.role == 'superadmin') return const _SuperAdminNotice();
    return const HomeShell();
  }
}

class _SuperAdminNotice extends StatelessWidget {
  const _SuperAdminNotice();
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.c.background,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Super Admin', style: KText.h2.copyWith(color: context.c.onSurface)),
              const SizedBox(height: 8),
              Text(
                'The super-admin panel is managed from the web dashboard.',
                textAlign: TextAlign.center,
                style: KText.bodyMd.copyWith(color: context.c.onSurfaceVariant),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => context.read<AuthProvider>().logout(),
                child: const Text('Sign Out'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
