import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../providers/auth_provider.dart';
import '../../services/subscription.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

/// Plan picker and PhonePe checkout.
///
/// Checkout leaves the app: PhonePe's hosted page opens in an in-app browser
/// (SFSafariViewController on iOS, Custom Tabs on Android), because UPI has to
/// hand off to the payer's UPI app to collect a PIN. When the user comes back,
/// the app asks the server what actually happened — returning from the browser
/// says nothing about whether money moved.
class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> with WidgetsBindingObserver {
  List<SubscriptionPlan> _plans = [];
  List<PlanFeature> _features = [];
  int _visibleCount = 8;
  String? _selected;
  bool _expanded = false;
  bool _loading = true;
  bool _busy = false;

  /// Set while a checkout is in flight, so returning to the foreground knows
  /// there is something to reconcile.
  String? _pendingOrderId;

  static const _icons = <String, IconData>{
    'group': MSym.group,
    'devices': MSym.devices,
    'chat': MSym.chat,
    'qr_code_scanner': MSym.qrCodeScanner,
    'badge': MSym.badge,
    'store': MSym.store,
    'person_add': MSym.personAdd,
    'bar_chart': MSym.barChart,
    'cloud_done': MSym.cloudDone,
    'backup': MSym.backup,
    'event_available': MSym.eventAvailable,
    'notifications_active': MSym.notificationImportant,
    'notifications': MSym.notifications,
    'picture_as_pdf': MSym.pictureAsPdf,
    'receipt_long': MSym.receiptLong,
    'upload_file': MSym.uploadFile,
    'support_agent': MSym.supportAgent,
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _pendingOrderId != null) {
      _reconcile();
    }
  }

  Future<void> _load() async {
    try {
      final db = FirebaseFirestore.instance;
      final results = await Future.wait([
        db.collection('subscriptionPlans').get(),
        db.collection('appConfig').doc('subscriptionFeatures').get(),
      ]);
      final plansSnap = results[0] as QuerySnapshot<Map<String, dynamic>>;
      final configSnap = results[1] as DocumentSnapshot<Map<String, dynamic>>;

      final plans = plansSnap.docs
          .map((d) => SubscriptionPlan.fromDoc(d.id, d.data()))
          .where((p) => p.isUsable)
          .toList()
        ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

      final cfg = configSnap.data() ?? {};
      final features = ((cfg['features'] as List?) ?? [])
          .map((m) => PlanFeature.fromMap(Map<String, dynamic>.from(m as Map)))
          .toList();

      if (!mounted) return;
      setState(() {
        _plans = plans;
        _selected = plans.isNotEmpty ? plans.first.id : null;
        _features = features;
        _visibleCount = (cfg['visibleCount'] as num?)?.toInt() ?? 8;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
      _toast('Could not load plans');
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _pay() async {
    final auth = context.read<AuthProvider>();
    final gymId = auth.gymId;
    if (gymId == null || _selected == null) return;

    setState(() => _busy = true);
    try {
      final order = await SubscriptionApi.createOrder(gymId: gymId, planId: _selected!);
      _pendingOrderId = order.merchantOrderId;
      await launchUrl(
        Uri.parse(order.redirectUrl),
        mode: LaunchMode.inAppBrowserView,
      );
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reconcile() async {
    final auth = context.read<AuthProvider>();
    final gymId = auth.gymId;
    final orderId = _pendingOrderId;
    if (gymId == null || orderId == null) return;

    try {
      final res = await SubscriptionApi.checkOrder(gymId: gymId, merchantOrderId: orderId);
      if (res.state == 'COMPLETED') {
        _pendingOrderId = null;
        await auth.refreshGym();
        _toast(res.planEndDate != null
            ? 'Payment received — active until ${res.planEndDate}'
            : 'Payment received');
      } else if (res.state == 'FAILED') {
        _pendingOrderId = null;
        _toast('Payment did not go through. Nothing was charged.');
      }
      // PENDING: leave _pendingOrderId set so the next resume checks again.
    } catch (_) {
      // Network hiccup on resume is not worth interrupting anyone over; the
      // webhook grants the plan regardless of whether this poll succeeds.
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final auth = context.watch<AuthProvider>();
    final left = daysLeft(auth.gymData?['planEndDate'] as String?);
    final plan = _plans.where((p) => p.id == _selected).firstOrNull;
    final shown = _expanded ? _features : _features.take(_visibleCount).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Subscription')),
      body: _loading
          ? const KLoading()
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                _StatusLine(daysLeft: left),
                const SizedBox(height: 16),
                for (final p in _plans) ...[
                  _PlanTile(
                    plan: p,
                    selected: p.id == _selected,
                    onTap: () => setState(() => _selected = p.id),
                  ),
                  const SizedBox(height: 10),
                ],
                const SizedBox(height: 8),
                for (final f in shown)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Sym(
                          _icons[f.icon] ?? MSym.check,
                          size: 20,
                          color: f.highlight ? c.primary : c.onSurfaceVariant,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            f.label,
                            style: TextStyle(
                              fontSize: 14,
                              color: f.highlight ? c.onSurface : c.onSurfaceVariant,
                              fontWeight: f.highlight ? FontWeight.w600 : FontWeight.w400,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                if (_features.length > _visibleCount)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: () => setState(() => _expanded = !_expanded),
                      child: Text(_expanded
                          ? 'View less'
                          : 'View more (${_features.length - _visibleCount})'),
                    ),
                  ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _busy || plan == null ? null : _pay,
                  icon: _busy
                      ? const SizedBox(width: 18, height: 18, child: KSpinner())
                      : const Sym(MSym.shoppingCart, size: 20),
                  label: Text(_busy
                      ? 'Starting…'
                      : 'Pay ₹${plan?.priceInr ?? 0} with PhonePe'),
                  style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                ),
                const SizedBox(height: 10),
                Text(
                  'Secure UPI, card and netbanking via PhonePe. '
                  'Renewing early adds to the time you already have.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, color: c.onSurfaceVariant),
                ),
              ],
            ),
    );
  }
}

class _StatusLine extends StatelessWidget {
  final int? daysLeft;
  const _StatusLine({required this.daysLeft});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final (String text, Color colour) = switch (daysLeft) {
      null => ('No active subscription', TW.rose600),
      final d when d < 0 => ('Expired', TW.rose600),
      final d when d <= 14 => ('$d day${d == 1 ? '' : 's'} left', TW.amber600),
      final d => ('$d days left', TW.emerald600),
    };
    return Row(
      children: [
        Sym(MSym.workspacePremium, size: 20, color: colour),
        const SizedBox(width: 8),
        Text(text, style: TextStyle(color: colour, fontWeight: FontWeight.w600)),
        const Spacer(),
        Text('Kilos Pro', style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
      ],
    );
  }
}

class _PlanTile extends StatelessWidget {
  final SubscriptionPlan plan;
  final bool selected;
  final VoidCallback onTap;
  const _PlanTile({required this.plan, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? c.primary : c.outlineVariant.withValues(alpha: 0.5),
            width: selected ? 2 : 1,
          ),
          color: selected ? c.primary.withValues(alpha: 0.06) : null,
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Text(plan.name,
                        style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w600)),
                    if (plan.badge.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Pill(plan.badge, bg: c.primaryContainer, fg: c.primary),
                    ],
                  ]),
                  const SizedBox(height: 2),
                  Text('${plan.durationDays} days',
                      style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
                ],
              ),
            ),
            Text('₹${plan.priceInr}',
                style: TextStyle(
                    color: c.onSurface, fontSize: 20, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}
