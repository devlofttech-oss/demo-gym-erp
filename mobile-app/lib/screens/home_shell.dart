import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../theme/app_icons.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import 'dashboard/dashboard_screen.dart';
import 'members/members_screen.dart';
import 'payments/payments_screen.dart';
import 'checkin/checkin_screen.dart';
import 'attendance/attendance_screen.dart';

class _NavItem {
  final IconData icon;
  final String label;
  final Widget screen;
  const _NavItem(this.icon, this.label, this.screen);
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  List<_NavItem> _itemsFor(String? role) {
    if (role == 'staff') {
      return const [
        _NavItem(MSym.howToReg, 'Check-in', CheckinScreen()),
        _NavItem(MSym.eventAvailable, 'Attendance', AttendanceScreen()),
      ];
    }
    return const [
      _NavItem(MSym.monitoring, 'Dashboard', DashboardScreen()),
      _NavItem(MSym.group, 'Members', MembersScreen()),
      _NavItem(MSym.accountBalanceWallet, 'Payments', PaymentsScreen()),
      _NavItem(MSym.howToReg, 'Check-in', CheckinScreen()),
      _NavItem(MSym.eventAvailable, 'Attendance', AttendanceScreen()),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final items = _itemsFor(auth.role);
    if (_index >= items.length) _index = 0;
    final c = context.c;

    return Scaffold(
      backgroundColor: c.background,
      appBar: _TopBar(auth: auth),
      body: IndexedStack(
        index: _index,
        children: items.map((e) => e.screen).toList(),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: c.surfaceContainerLowest,
          border: Border(top: BorderSide(color: c.outlineVariant.withValues(alpha: 0.3))),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 64,
            child: Row(
              children: [
                for (var i = 0; i < items.length; i++)
                  Expanded(
                    child: InkWell(
                      onTap: () => setState(() => _index = i),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Sym(items[i].icon,
                              size: 24,
                              fill: _index == i,
                              color: _index == i ? c.primary : TW.slate400),
                          const SizedBox(height: 3),
                          Text(items[i].label,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w500,
                                color: _index == i ? c.primary : TW.slate400,
                              )),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget implements PreferredSizeWidget {
  final AuthProvider auth;
  const _TopBar({required this.auth});
  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final theme = context.watch<ThemeProvider>();
    return AppBar(
      backgroundColor: c.surfaceContainerLowest,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      leadingWidth: 52,
      leading: Padding(
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
        _ProfileMenu(auth: auth),
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

class _ProfileMenu extends StatelessWidget {
  final AuthProvider auth;
  const _ProfileMenu({required this.auth});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final name = auth.userName.isNotEmpty ? auth.userName : (auth.currentUser?.email?.split('@').first ?? 'User');
    return PopupMenuButton<String>(
      offset: const Offset(0, 48),
      onSelected: (v) {
        if (v == 'logout') auth.logout();
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
      ],
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: InitialAvatar(name: name, size: 34, bg: c.primaryContainer, fg: c.primary),
      ),
    );
  }
}
