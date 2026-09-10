import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../services/subscription.dart';
import '../theme/app_icons.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import '../widgets/delete_account.dart';
import '../widgets/notification_panel.dart';
import '../widgets/update_banner.dart';
import 'attendance/attendance_screen.dart';
import 'checkin/checkin_screen.dart';
import 'classes/classes_screen.dart';
import 'dashboard/dashboard_screen.dart';
import 'diet/diet_screen.dart';
import 'equipment/equipment_screen.dart';
import 'expenses/expenses_screen.dart';
import 'leads/leads_screen.dart';
import 'measurements/measurements_screen.dart';
import 'members/add_member_screen.dart';
import 'members/members_screen.dart';
import 'payments/payment_screen.dart';
import 'payments/payments_screen.dart';
import 'plans/plans_screen.dart';
import 'pt/pt_screen.dart';
import 'renewals/renewals_screen.dart';
import 'reports/report_screen.dart';
import 'settings/settings_screen.dart';
import 'staff/staff_screen.dart';
import 'subscription/subscription_screen.dart';
import 'supplements/supplements_screen.dart';
import 'workouts/workouts_screen.dart';

const _webAppUrl = 'https://app-kilos.devlofttech.com';
const _waCreditsUrl = '$_webAppUrl/whatsapp-credits';
const _iosAppUrl = 'https://apps.apple.com/in/app/kilos-gym/id6804961729';
const _androidAppUrl = 'https://play.google.com/store/apps/details?id=com.devloft.kilos';
const _youtubeUrl = 'https://www.youtube.com/@DevloftTechnologies';
const _contactWa = 'https://wa.me/917012583444';

// ─── Dock items (shown in the floating oval) ────────────────────────────────

class _DockItem {
  final IconData icon;
  final String label;
  final Widget screen;
  const _DockItem(this.icon, this.label, this.screen);
}

List<_DockItem> _adminDock() => const [
      _DockItem(MSym.monitoring, 'Home', DashboardScreen()),
      _DockItem(MSym.group, 'Members', MembersScreen()),
      _DockItem(MSym.accountBalanceWallet, 'Payments', PaymentsScreen()),
      _DockItem(MSym.howToReg, 'Check-in', CheckinScreen()),
    ];

List<_DockItem> _staffDock() => const [
      _DockItem(MSym.howToReg, 'Check-in', CheckinScreen()),
      _DockItem(MSym.eventAvailable, 'Attendance', AttendanceScreen()),
    ];

// ─── Shell ──────────────────────────────────────────────────────────────────

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with TickerProviderStateMixin {
  int _index = 0;
  bool _quickOpen = false;
  late AnimationController _fabCtrl;

  @override
  void initState() {
    super.initState();
    _fabCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 220));
  }

  @override
  void dispose() {
    _fabCtrl.dispose();
    super.dispose();
  }

  void _toggleQuick() {
    setState(() => _quickOpen = !_quickOpen);
    if (_quickOpen) {
      _fabCtrl.forward();
    } else {
      _fabCtrl.reverse();
    }
  }

  void _closeQuick() {
    if (_quickOpen) {
      setState(() => _quickOpen = false);
      _fabCtrl.reverse();
    }
  }

  void _push(Widget screen) {
    _closeQuick();
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  Future<void> _launch(String url) async {
    _closeQuick();
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open link')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final items = auth.role == 'staff' ? _staffDock() : _adminDock();
    if (_index >= items.length) _index = 0;
    final c = context.c;

    return Scaffold(
      backgroundColor: c.background,
      key: const ValueKey('home_shell'),
      appBar: _TopBar(auth: auth),
      drawer: auth.role == 'staff'
          ? null
          : _KilosDrawer(
              auth: auth,
              onNavTap: (idx) {
                setState(() => _index = idx);
                Navigator.of(context).pop();
              },
              onPushScreen: _push,
              onLaunchUrl: _launch,
              currentIndex: _index,
            ),
      body: GestureDetector(
        onTap: _closeQuick,
        behavior: HitTestBehavior.translucent,
        child: Stack(
          children: [
            Column(
              children: [
                const UpdateBanner(),
                Expanded(
                  child: IndexedStack(
                    index: _index,
                    children: items.map((e) => e.screen).toList(),
                  ),
                ),
                // Reserve space so content isn't hidden behind dock + safe area.
                SizedBox(height: 96 + MediaQuery.of(context).padding.bottom),
              ],
            ),
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: _BottomNavArea(
                items: items,
                index: _index,
                onSelect: (i) => setState(() {
                  _index = i;
                  _closeQuick();
                }),
                quickOpen: _quickOpen,
                fabCtrl: _fabCtrl,
                onFabTap: _toggleQuick,
                onQuickAction: (action) {
                  _closeQuick();
                  switch (action) {
                    case _QuickAction.addMember:
                      _push(const AddMemberScreen());
                    case _QuickAction.checkin:
                      setState(() => _index = auth.role == 'staff' ? 0 : 3);
                    case _QuickAction.recordPayment:
                      _push(const PaymentScreen());
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Bottom nav area (dock + FAB + quick stack) ─────────────────────────────

enum _QuickAction { addMember, checkin, recordPayment }

class _BottomNavArea extends StatelessWidget {
  final List<_DockItem> items;
  final int index;
  final ValueChanged<int> onSelect;
  final bool quickOpen;
  final AnimationController fabCtrl;
  final VoidCallback onFabTap;
  final ValueChanged<_QuickAction> onQuickAction;

  const _BottomNavArea({
    required this.items,
    required this.index,
    required this.onSelect,
    required this.quickOpen,
    required this.fabCtrl,
    required this.onFabTap,
    required this.onQuickAction,
  });

  @override
  Widget build(BuildContext context) {
    final safeBottom = MediaQuery.of(context).padding.bottom;
    // The dock area is 58px dock + 16px top gap + safe area.
    final dockAreaH = 58.0 + 16.0 + safeBottom + 12;
    final c = context.c;

    return SizedBox(
      width: double.infinity,
      height: dockAreaH,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // ── Quick-action stack — floats above, no height impact ────
          Positioned(
            right: 26,
            bottom: dockAreaH + 8,
            child: IgnorePointer(
              ignoring: !quickOpen,
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 200),
                opacity: quickOpen ? 1 : 0,
                child: AnimatedSlide(
                  duration: const Duration(milliseconds: 200),
                  offset: quickOpen ? Offset.zero : const Offset(0, 0.12),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      _QuickBtn(
                        icon: MSym.personAdd,
                        label: 'Add member',
                        onTap: () => onQuickAction(_QuickAction.addMember),
                      ),
                      const SizedBox(height: 10),
                      _QuickBtn(
                        icon: MSym.qrCodeScanner,
                        label: 'Scan check-in',
                        onTap: () => onQuickAction(_QuickAction.checkin),
                      ),
                      const SizedBox(height: 10),
                      _QuickBtn(
                        icon: MSym.payments,
                        label: 'Record payment',
                        onTap: () => onQuickAction(_QuickAction.recordPayment),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // ── FAB ────────────────────────────────────────────────────
          Positioned(
            right: 26,
            bottom: safeBottom + 22,
            child: GestureDetector(
              onTap: onFabTap,
              child: Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF26232F), KD.dockEnd],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0x66140F2D),
                      blurRadius: 26,
                      offset: const Offset(0, 14),
                    ),
                    BoxShadow(
                      color: c.background,
                      blurRadius: 0,
                      spreadRadius: 6,
                    ),
                  ],
                ),
                child: AnimatedBuilder(
                  animation: fabCtrl,
                  builder: (_, _) => Transform.rotate(
                    angle: fabCtrl.value * 0.785398,
                    child: const Icon(Icons.add, color: Colors.white, size: 22),
                  ),
                ),
              ),
            ),
          ),

          // ── Oval dock ──────────────────────────────────────────────
          Positioned(
            left: 0,
            right: 0,
            bottom: safeBottom + 16,
            child: Center(
              child: _FloatingDock(items: items, index: index, onSelect: onSelect),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _QuickBtn({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: c.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: c.outlineVariant.withValues(alpha: 0.5)),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 12, offset: const Offset(0, 4)),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 26, height: 26,
              decoration: const BoxDecoration(color: KD.primaryTint, shape: BoxShape.circle),
              child: Icon(icon, color: KD.primaryDeep, size: 14),
            ),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: KD.ink)),
          ],
        ),
      ),
    );
  }
}

class _FloatingDock extends StatelessWidget {
  final List<_DockItem> items;
  final int index;
  final ValueChanged<int> onSelect;
  const _FloatingDock({required this.items, required this.index, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 58,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [KD.dockStart, KD.dockEnd],
        ),
        borderRadius: BorderRadius.circular(29),
        boxShadow: [
          BoxShadow(color: KD.primaryDeep.withValues(alpha: 0.35), blurRadius: 36, offset: const Offset(0, 18)),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < items.length; i++)
              _DockButton(
                item: items[i],
                isActive: index == i,
                onTap: () => onSelect(i),
              ),
          ],
        ),
      ),
    );
  }
}

class _DockButton extends StatelessWidget {
  final _DockItem item;
  final bool isActive;
  final VoidCallback onTap;
  const _DockButton({required this.item, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        height: 42,
        padding: EdgeInsets.symmetric(horizontal: isActive ? 14 : 12),
        decoration: BoxDecoration(
          color: isActive ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(21),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Sym(
              item.icon,
              size: 18,
              fill: isActive,
              color: isActive ? KD.primaryDeep : Colors.white.withValues(alpha: 0.55),
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 220),
              child: isActive
                  ? Row(mainAxisSize: MainAxisSize.min, children: [
                      const SizedBox(width: 7),
                      Text(
                        item.label,
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: KD.primaryDeep,
                        ),
                      ),
                    ])
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Side Drawer ─────────────────────────────────────────────────────────────

class _KilosDrawer extends StatelessWidget {
  final AuthProvider auth;
  final ValueChanged<int> onNavTap;
  final ValueChanged<Widget> onPushScreen;
  final ValueChanged<String> onLaunchUrl;
  final int currentIndex;

  const _KilosDrawer({
    required this.auth,
    required this.onNavTap,
    required this.onPushScreen,
    required this.onLaunchUrl,
    required this.currentIndex,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final name = auth.userName.isNotEmpty ? auth.userName : (auth.currentUser?.email?.split('@').first ?? 'Admin');

    return Drawer(
      backgroundColor: c.surfaceContainerLowest,
      width: MediaQuery.of(context).size.width * 0.80,
      child: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                children: [
                  // Drawer head: brand logo + close
                  Row(children: [
                    Container(
                      width: 30, height: 30,
                      decoration: BoxDecoration(borderRadius: BorderRadius.circular(8)),
                      clipBehavior: Clip.antiAlias,
                      child: Image.asset('assets/images/kilos_logo.png', fit: BoxFit.contain),
                    ),
                    const SizedBox(width: 8),
                    Text('Kilos', style: KText.h3.copyWith(color: c.onSurface, fontSize: 17)),
                    const Spacer(),
                    GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      child: Container(
                        width: 32, height: 32,
                        decoration: BoxDecoration(
                          color: c.surfaceContainerHigh,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Center(child: Icon(Icons.close, color: c.onSurfaceVariant, size: 14)),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 16),

                  // Profile row
                  Row(children: [
                    InitialAvatar(name: name, size: 40, bg: KD.primaryTint, fg: KD.primary),
                    const SizedBox(width: 12),
                    Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name, style: KText.h3.copyWith(color: c.onSurface, fontSize: 14)),
                        Text(auth.role?.toUpperCase() ?? 'ADMIN',
                            style: TextStyle(color: c.onSurfaceVariant, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                      ],
                    )),
                  ]),
                  const SizedBox(height: 14),

                  // Subscription card
                  Builder(builder: (_) {
                    final left = daysLeft(auth.gymData?['planEndDate'] as String?);
                    final planName = auth.gymData?['planName'] as String? ?? 'No plan';
                    final (Color tone, String badge) = switch (left) {
                      null => (TW.rose600, 'No plan'),
                      final d when d < 0 => (TW.rose600, 'Expired'),
                      final d when d <= 14 => (TW.amber600, '${d}d left'),
                      final d => (KD.teal, '${d}d left'),
                    };
                    return Container(
                      margin: const EdgeInsets.only(bottom: 14),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: KD.primaryTint,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: KD.primary.withValues(alpha: 0.15)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('PLAN', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: 0.08, color: c.onSurfaceVariant)),
                          const SizedBox(height: 2),
                          Text(planName, style: KText.h3.copyWith(fontSize: 16, color: c.onSurface)),
                          const SizedBox(height: 6),
                          Row(children: [
                            Icon(Icons.circle, size: 8, color: tone),
                            const SizedBox(width: 5),
                            Text(badge, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: tone)),
                          ]),
                          const SizedBox(height: 10),
                          GestureDetector(
                            onTap: () {
                              Navigator.of(context).pop();
                              Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SubscriptionScreen()));
                            },
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(vertical: 11),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [KD.primary, KD.primaryDeep],
                                  begin: Alignment.centerLeft,
                                  end: Alignment.centerRight,
                                ),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                Icon(Icons.shopping_cart_outlined, color: Colors.white, size: 16),
                                SizedBox(width: 7),
                                Text('Buy / Renew', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13.5)),
                              ]),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),

                  // Primary navigation
                  _DrawerSection('Primary', [
                    _DrawerNavItem(MSym.monitoring, 'Dashboard', () => onNavTap(0), active: currentIndex == 0),
                    _DrawerNavItem(MSym.group, 'Members', () => onNavTap(1), active: currentIndex == 1),
                    _DrawerNavItem(MSym.accountBalanceWallet, 'Payments', () => onNavTap(2), active: currentIndex == 2),
                    _DrawerNavItem(MSym.howToReg, 'Check-in', () => onNavTap(3), active: currentIndex == 3),
                    _DrawerNavItem(MSym.eventAvailable, 'Attendance', () {
                      Navigator.of(context).pop();
                      onPushScreen(const AttendanceScreen());
                    }),
                    _DrawerNavItem(MSym.barChart, 'Reports', () {
                      Navigator.of(context).pop();
                      onPushScreen(const ReportScreen());
                    }),
                  ]),

                  // Configuration
                  _DrawerSection('Configuration', [
                    _DrawerNavItem(MSym.cardMembership, 'Plans', () {
                      Navigator.of(context).pop();
                      onPushScreen(const PlansScreen());
                    }),
                    _DrawerNavItem(MSym.groups, 'Classes', () {
                      Navigator.of(context).pop();
                      onPushScreen(const ClassesScreen());
                    }),
                    _DrawerNavItem(MSym.badge, 'Staff', () {
                      Navigator.of(context).pop();
                      onPushScreen(const StaffScreen());
                    }),
                    _DrawerNavItem(MSym.person, 'Personal Training', () {
                      Navigator.of(context).pop();
                      onPushScreen(const PTScreen());
                    }),
                    _DrawerNavItem(MSym.autorenew, 'Renewals', () {
                      Navigator.of(context).pop();
                      onPushScreen(const RenewalsScreen());
                    }),
                  ]),

                  // Management
                  _DrawerSection('Management', [
                    _DrawerNavItem(MSym.campaign, 'Leads & CRM', () {
                      Navigator.of(context).pop();
                      onPushScreen(const LeadsScreen());
                    }),
                    _DrawerNavItem(MSym.fitnessCenter, 'Workout Plans', () {
                      Navigator.of(context).pop();
                      onPushScreen(const WorkoutsScreen());
                    }),
                    _DrawerNavItem(MSym.restaurant, 'Diet Plans', () {
                      Navigator.of(context).pop();
                      onPushScreen(const DietScreen());
                    }),
                    _DrawerNavItem(MSym.monitorWeight, 'Measurements', () {
                      Navigator.of(context).pop();
                      onPushScreen(const MeasurementsScreen());
                    }),
                    _DrawerNavItem(MSym.medication, 'Supplements', () {
                      Navigator.of(context).pop();
                      onPushScreen(const SupplementsScreen());
                    }),
                    _DrawerNavItem(MSym.build, 'Equipment', () {
                      Navigator.of(context).pop();
                      onPushScreen(const EquipmentScreen());
                    }),
                    _DrawerNavItem(MSym.receipt, 'Expenses', () {
                      Navigator.of(context).pop();
                      onPushScreen(const ExpensesScreen());
                    }),
                  ]),

                  // Other
                  _DrawerSection('Other', [
                    _DrawerNavItem(MSym.chat, 'Purchase WhatsApp Credits', () {
                      Navigator.of(context).pop();
                      onLaunchUrl(_waCreditsUrl);
                    }),
                    _DrawerNavItem(MSym.language, 'Access web app', () {
                      Navigator.of(context).pop();
                      onLaunchUrl(_webAppUrl);
                    }),
                    _DrawerNavItem(Icons.phone_iphone, 'Download iOS app', () {
                      Navigator.of(context).pop();
                      onLaunchUrl(_iosAppUrl);
                    }),
                    _DrawerNavItem(Icons.android, 'Download Android app', () {
                      Navigator.of(context).pop();
                      onLaunchUrl(_androidAppUrl);
                    }),
                    _DrawerNavItem(MSym.playCircle, 'How to use Kilos?', () {
                      Navigator.of(context).pop();
                      onLaunchUrl(_youtubeUrl);
                    }),
                    _DrawerNavItem(MSym.supportAgent, 'Contact us', () {
                      Navigator.of(context).pop();
                      onLaunchUrl(_contactWa);
                    }),
                    _DrawerNavItem(MSym.settings, 'Settings', () {
                      Navigator.of(context).pop();
                      onPushScreen(const SettingsScreen());
                    }),
                  ]),

                  const SizedBox(height: 8),
                ],
              ),
            ),

            // Logout
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: _DrawerLogoutRow(),
            ),
          ],
        ),
      ),
    );
  }
}

class _DrawerSection extends StatelessWidget {
  final String title;
  final List<Widget> items;
  const _DrawerSection(this.title, this.items);

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 14, 4, 6),
          child: Text(
            title.toUpperCase(),
            style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: 0.08, color: c.onSurfaceVariant),
          ),
        ),
        ...items,
      ],
    );
  }
}

class _DrawerNavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool active;
  const _DrawerNavItem(this.icon, this.label, this.onTap, {this.active = false});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 11),
        decoration: BoxDecoration(
          color: active ? KD.primaryTint : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(
              color: active ? KD.primary.withValues(alpha: 0.12) : c.surfaceContainer,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Sym(icon, size: 16, color: active ? KD.primary : KD.primaryDeep, fill: active),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(label,
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: active ? KD.primary : c.onSurface,
              ))),
          if (active)
            const Icon(Icons.chevron_right, size: 16, color: KD.primary)
          else
            Icon(Icons.chevron_right, size: 16, color: c.onSurfaceVariant.withValues(alpha: 0.4)),
        ]),
      ),
    );
  }
}

class _DrawerLogoutRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final auth = context.read<AuthProvider>();
    return Column(
      children: [
        InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => showDeleteAccountDialog(context),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 11),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.person_remove_outlined, color: TW.rose500, size: 18),
              const SizedBox(width: 8),
              Text('Delete account', style: TextStyle(color: TW.rose500, fontWeight: FontWeight.w600, fontSize: 13.5)),
            ]),
          ),
        ),
        const SizedBox(height: 6),
        InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => auth.logout(),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFECE9),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.logout, color: Color(0xFFC0341F), size: 18),
              SizedBox(width: 8),
              Text('Logout', style: TextStyle(color: Color(0xFFC0341F), fontWeight: FontWeight.w700, fontSize: 13.5)),
            ]),
          ),
        ),
      ],
    );
  }
}

// ─── Top bar ────────────────────────────────────────────────────────────────

class _TopBar extends StatelessWidget implements PreferredSizeWidget {
  final AuthProvider auth;
  const _TopBar({required this.auth});
  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final theme = context.watch<ThemeProvider>();
    final isAdmin = auth.role != 'staff';

    return AppBar(
      backgroundColor: c.surfaceContainerLowest,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      leadingWidth: 52,
      leading: isAdmin
          ? Builder(builder: (ctx) => IconButton(
                icon: Sym(MSym.menu, size: 22, color: c.onSurface),
                onPressed: () => Scaffold.of(ctx).openDrawer(),
              ))
          : Padding(
              padding: const EdgeInsets.only(left: 14),
              child: Image.asset('assets/images/kilos_logo.png', width: 30, height: 30),
            ),
      title: auth.isMultiBranch
          ? _BranchSwitcher(auth: auth)
          : Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(auth.gymName,
                    style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w700, fontSize: 16)),
                Text('powered by Kilos',
                    style: TextStyle(color: TW.slate400, fontSize: 10, letterSpacing: 1, fontWeight: FontWeight.w500)),
              ],
            ),
      actions: [
        IconButton(
          onPressed: theme.toggle,
          icon: Sym(theme.isDark ? MSym.lightMode : MSym.darkMode, size: 22, color: c.onSurfaceVariant),
          tooltip: theme.isDark ? 'Light mode' : 'Dark mode',
        ),
        const NotificationBell(),
        if (!isAdmin) _ProfileMenuMinimal(auth: auth),
        const SizedBox(width: 6),
      ],
    );
  }
}

class _BranchSwitcher extends StatelessWidget {
  final AuthProvider auth;
  const _BranchSwitcher({required this.auth});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return PopupMenuButton<String>(
      onSelected: (id) => auth.switchBranch(id),
      itemBuilder: (_) => [
        for (final b in auth.gymBranches)
          PopupMenuItem(
            value: b.id,
            child: Row(
              children: [
                Expanded(child: Text(b.name, style: TextStyle(color: c.onSurface))),
                if (b.id == auth.gymId) Sym(MSym.checkCircle, size: 16, color: c.primary),
              ],
            ),
          ),
      ],
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(auth.gymName,
                  style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w700, fontSize: 16)),
              Text('powered by Kilos',
                  style: TextStyle(color: TW.slate400, fontSize: 10, letterSpacing: 1, fontWeight: FontWeight.w500)),
            ],
          ),
          Sym(MSym.expandMore, size: 18, color: TW.slate500),
        ],
      ),
    );
  }
}

// Profile menu for staff (no drawer, so they get a popup menu in the top bar)
class _ProfileMenuMinimal extends StatelessWidget {
  final AuthProvider auth;
  const _ProfileMenuMinimal({required this.auth});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final name = auth.userName.isNotEmpty ? auth.userName : (auth.currentUser?.email?.split('@').first ?? 'User');
    return PopupMenuButton<String>(
      offset: const Offset(0, 48),
      onSelected: (v) {
        if (v == 'logout') auth.logout();
        if (v == 'delete') showDeleteAccountDialog(context);
      },
      itemBuilder: (_) => [
        PopupMenuItem(
          enabled: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w600)),
              Text(auth.currentUser?.email ?? '', style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
            ],
          ),
        ),
        const PopupMenuDivider(),
        PopupMenuItem(
          value: 'logout',
          child: Row(children: [
            Sym(MSym.logout, size: 18, color: c.error),
            const SizedBox(width: 8),
            Text('Sign Out', style: TextStyle(color: c.error)),
          ]),
        ),
        PopupMenuItem(
          value: 'delete',
          child: Row(children: [
            Sym(MSym.close, size: 18, color: TW.rose600),
            const SizedBox(width: 8),
            const Text('Delete account', style: TextStyle(color: TW.rose600)),
          ]),
        ),
      ],
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: InitialAvatar(name: name, size: 34, bg: c.primaryContainer, fg: c.primary),
      ),
    );
  }
}
