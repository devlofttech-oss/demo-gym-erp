import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/tenant_db.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import 'landing_screen.dart';
import 'home_shell.dart';
import 'onboarding/onboarding_screen.dart';
import 'subscription/subscription_screen.dart';

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
    if (auth.currentUser == null) return const LandingScreen();
    if (auth.role == 'superadmin') return const _SuperAdminNotice();
    // An expired or not-yet-started plan confines the gym to the subscription
    // screen rather than ending the session, so an admin can still pay. Web
    // does the same in RoleRoute; without it a lapsed gym kept full access here.
    if (auth.isPlanBlocked) return const _PlanBlockedScreen();
    if (auth.role == 'staff') return const HomeShell();
    // Admin: check if they have plans set up yet
    return const _PostLoginGate();
  }
}

/// Shown while the gym's plan has lapsed or has not started. Staff cannot pay,
/// so they get an explanation; admins get the subscription screen itself.
class _PlanBlockedScreen extends StatelessWidget {
  const _PlanBlockedScreen();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final notStarted = auth.planBlockReason == 'plan_not_started';

    if (auth.role == 'staff') {
      return Scaffold(
        backgroundColor: context.c.background,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  notStarted
                      ? 'Subscription not active yet'
                      : 'Subscription ended',
                  style: KText.h2.copyWith(color: context.c.onSurface),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  notStarted
                      ? 'This plan has not started yet. Ask the gym admin when it begins.'
                      : 'This plan has ended. Ask the gym admin to renew it.',
                  textAlign: TextAlign.center,
                  style: KText.bodyMd.copyWith(
                    color: context.c.onSurfaceVariant,
                  ),
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

    return const SubscriptionScreen(showSignOut: true);
  }
}

/// Checks if the gym has any plans; shows OnboardingScreen if not.
class _PostLoginGate extends StatefulWidget {
  const _PostLoginGate();
  @override
  State<_PostLoginGate> createState() => _PostLoginGateState();
}

class _PostLoginGateState extends State<_PostLoginGate> {
  bool _checking = true;
  bool _needsOnboarding = false;

  @override
  void initState() {
    super.initState();
    _checkPlans();
  }

  Future<void> _checkPlans() async {
    final gymId = context.read<AuthProvider>().gymId;
    if (gymId == null || gymId.isEmpty) {
      if (mounted) setState(() => _checking = false);
      return;
    }
    try {
      final plans = await TenantDb.getCollection(gymId, 'plans');
      if (mounted) {
        setState(() {
          _needsOnboarding = plans.isEmpty;
          _checking = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _checking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return Scaffold(
        backgroundColor: context.c.background,
        body: const Center(child: KSpinner(size: 40)),
      );
    }
    if (_needsOnboarding) {
      return OnboardingScreen(
        onComplete: () => setState(() => _needsOnboarding = false),
      );
    }
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
              Text(
                'Super Admin',
                style: KText.h2.copyWith(color: context.c.onSurface),
              ),
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
