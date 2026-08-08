import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../members/add_member_screen.dart';
import '../payments/payment_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _loading = true;
  // stats
  num _revenue = 0, _monthlyRevenue = 0, _totalExpenses = 0, _monthlyExpenses = 0;
  int _activeMembers = 0, _totalMembers = 0, _dailyAttendance = 0;
  num get _netProfit => _monthlyRevenue - _monthlyExpenses;

  List<Map<String, dynamic>> _todayAttendance = [];
  List<Map<String, dynamic>> _expiringSoon = [];
  List<_Activity> _recent = [];
  List<_XY> _revenueTrend = [];
  List<_Bar> _revVsExp = [];
  List<_XY> _revenueByPlan = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final gymId = context.read<AuthProvider>().gymId;
    try {
      final res = await Future.wait([
        TenantDb.getCollection(gymId, 'members'),
        TenantDb.getCollection(gymId, 'payments'),
        TenantDb.getCollection(gymId, 'attendance'),
        TenantDb.getCollection(gymId, 'expenses'),
      ]);
      final members = res[0], payments = res[1], attendance = res[2], expenses = res[3];
      final now = DateTime.now();

      _revenue = payments.fold<num>(0, (s, p) => s + asNum(p['amount']));
      _activeMembers = members.where((m) => m['status'] == 'Active').length;
      _totalMembers = members.length;

      bool sameMonth(dynamic d) {
        final dt = toDate(d);
        return dt != null && dt.month == now.month && dt.year == now.year;
      }

      _monthlyRevenue = payments.where((p) => sameMonth(p['date'])).fold<num>(0, (s, p) => s + asNum(p['amount']));
      _totalExpenses = expenses.fold<num>(0, (s, e) => s + asNum(e['amount']));
      _monthlyExpenses = expenses.where((e) => sameMonth(e['date'])).fold<num>(0, (s, e) => s + asNum(e['amount']));

      final today = todayStr();
      _todayAttendance = attendance.where((a) {
        if (a['date'] == today) return true;
        final dt = toDate(a['checkInTime'] ?? a['timestamp']);
        return dt != null && DateTime(dt.year, dt.month, dt.day) == DateTime(now.year, now.month, now.day);
      }).toList()
        ..sort((a, b) {
          final da = toDate(a['checkInTime'] ?? a['timestamp']) ?? DateTime(1970);
          final db = toDate(b['checkInTime'] ?? b['timestamp']) ?? DateTime(1970);
          return db.compareTo(da);
        });
      _dailyAttendance = _todayAttendance.length;

      final in7 = now.add(const Duration(days: 7));
      _expiringSoon = members.where((m) {
        final e = toDate(m['expiryDate']);
        return e != null && e.isAfter(now.subtract(const Duration(days: 1))) && e.isBefore(in7);
      }).toList();

      // Revenue trend grouped by date label
      final grp = <String, num>{};
      for (final p in payments) {
        final dt = toDate(p['date']);
        if (dt == null) continue;
        final k = DateFormat('d MMM').format(dt);
        grp[k] = (grp[k] ?? 0) + asNum(p['amount']);
      }
      _revenueTrend = grp.entries.map((e) => _XY(e.key, e.value)).toList();
      if (_revenueTrend.isEmpty) _revenueTrend = [_XY('Today', 0)];

      // Revenue by plan
      final planRev = <String, num>{};
      for (final p in payments) {
        final k = (p['planName'] as String?) ?? '—';
        planRev[k] = (planRev[k] ?? 0) + asNum(p['amount']);
      }
      _revenueByPlan = planRev.entries.map((e) => _XY(e.key, e.value)).toList();

      // Revenue vs expenses — last 6 months
      _revVsExp = [];
      for (var i = 5; i >= 0; i--) {
        final d = DateTime(now.year, now.month - i, 1);
        final label = DateFormat('MMM yy').format(d);
        final rev = payments.where((p) {
          final pd = toDate(p['date']);
          return pd != null && pd.month == d.month && pd.year == d.year;
        }).fold<num>(0, (s, p) => s + asNum(p['amount']));
        final exp = expenses.where((e) {
          final ed = toDate(e['date']);
          return ed != null && ed.month == d.month && ed.year == d.year;
        }).fold<num>(0, (s, e) => s + asNum(e['amount']));
        _revVsExp.add(_Bar(label, rev, exp));
      }

      // Recent activity
      final acts = <_Activity>[];
      for (final p in payments) {
        acts.add(_Activity('payment', 'Payment ${rupees(asNum(p['amount']))}', toDate(p['date'])));
      }
      for (final a in attendance) {
        acts.add(_Activity('checkin', '${a['memberName']} checked in', toDate(a['checkInTime'] ?? a['timestamp'])));
      }
      acts.sort((a, b) => (b.date ?? DateTime(1970)).compareTo(a.date ?? DateTime(1970)));
      _recent = acts.take(6).toList();
    } catch (_) {/* keep zeros */}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return RefreshIndicator(
      onRefresh: () async {
        setState(() => _loading = true);
        await _load();
      },
      child: ListView(
        padding: const EdgeInsets.all(KSpace.gutter),
        children: [
          Text('Dashboard Overview', style: KText.h1.copyWith(color: c.onSurface)),
          const SizedBox(height: 6),
          Text("Here's what's happening today.", style: KText.bodyLg.copyWith(color: c.onSurfaceVariant)),
          const SizedBox(height: 16),
          _quickActions(),
          const SizedBox(height: 20),
          _kpiGrid(),
          const SizedBox(height: 16),
          _expenseRow(),
          const SizedBox(height: 16),
          _todaysAttendance(),
          if (_expiringSoon.isNotEmpty) ...[const SizedBox(height: 16), _expiringAlert()],
          const SizedBox(height: 16),
          _chartCard('Revenue Trend', SizedBox(height: 220, child: _revenueTrendChart())),
          const SizedBox(height: 16),
          _chartCard('Membership Status', SizedBox(height: 200, child: _membershipPie())),
          const SizedBox(height: 16),
          _chartCard('Revenue vs Expenses (Last 6 Months)', SizedBox(height: 220, child: _revVsExpChart())),
          const SizedBox(height: 16),
          _chartCard('Revenue by Plan',
              _revenueByPlan.isEmpty
                  ? const KEmpty(icon: MSym.receiptLong, message: 'No payment data yet.')
                  : SizedBox(height: 220, child: _revByPlanChart())),
          const SizedBox(height: 16),
          _recentActivity(),
        ],
      ),
    );
  }

  Widget _quickActions() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _qa(MSym.personAdd, 'New Member', primary: true, onTap: () {
          Navigator.push(context, MaterialPageRoute(builder: (_) => const AddMemberScreen()));
        }),
        _qa(MSym.payments, 'Record Payment', onTap: () {
          Navigator.push(context, MaterialPageRoute(builder: (_) => const PaymentScreen()));
        }),
      ],
    );
  }

  Widget _qa(IconData icon, String label, {bool primary = false, VoidCallback? onTap}) {
    final c = context.c;
    return Material(
      color: primary ? c.primary : c.surfaceContainerLowest,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: primary ? null : Border.all(color: c.outlineVariant.withValues(alpha: 0.3)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Sym(icon, size: 16, color: primary ? c.onPrimary : c.onSurface),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(color: primary ? c.onPrimary : c.onSurface, fontWeight: FontWeight.w500, fontSize: 14)),
          ]),
        ),
      ),
    );
  }

  Widget _kpiGrid() {
    final c = context.c;
    final cards = [
      _kpi(MSym.accountBalanceWallet, c.primary, c.primaryContainer.withValues(alpha: 0.3), 'Total Revenue', _loading ? '...' : rupees(_revenue), 'All Time', TW.emerald600, TW.emerald50),
      _kpi(MSym.showChart, c.secondary, c.secondaryContainer.withValues(alpha: 0.3), 'Monthly Revenue', _loading ? '...' : rupees(_monthlyRevenue), 'This Month', TW.sky600, TW.sky50),
      _kpi(MSym.group, c.primary, c.primaryContainer.withValues(alpha: 0.3), 'Active Members', _loading ? '...' : '$_activeMembers', _loading ? '—' : '$_activeMembers/$_totalMembers', TW.violet600, TW.violet50),
      _kpi(MSym.howToReg, c.secondary, c.secondaryContainer.withValues(alpha: 0.3), 'Daily Attendance', _loading ? '...' : '$_dailyAttendance', 'Today', TW.amber600, TW.amber50, filled: true),
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: KSpace.stackGap,
      crossAxisSpacing: KSpace.stackGap,
      childAspectRatio: 1.35,
      children: cards,
    );
  }

  Widget _kpi(IconData icon, Color iconColor, Color iconBg, String label, String value, String tag, Color tagFg, Color tagBg, {bool filled = false}) {
    final c = context.c;
    return KCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(12)),
                child: Sym(icon, size: 22, color: iconColor, fill: filled),
              ),
              const Spacer(),
              Pill(tag, fg: tagFg, bg: tagBg.withValues(alpha: context.isDark ? 0.2 : 1)),
            ],
          ),
          const Spacer(),
          Text(label.toUpperCase(),
              style: KText.labelCaps.copyWith(color: c.onSurfaceVariant, letterSpacing: 0.5)),
          const SizedBox(height: 4),
          Text(value, style: KText.statValue.copyWith(color: c.onSurface), maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }

  Widget _expenseRow() {
    final profitPos = _netProfit >= 0;
    return Column(
      children: [
        Row(children: [
          Expanded(child: _expenseCard(MSym.receiptLong, TW.rose600, TW.rose100, 'Total Expenses', _loading ? '...' : rupees(_totalExpenses), 'All Time')),
          const SizedBox(width: KSpace.stackGap),
          Expanded(child: _expenseCard(MSym.trendingDown, TW.amber600, TW.amber100, 'Monthly Expenses', _loading ? '...' : rupees(_monthlyExpenses), 'This Month')),
        ]),
        const SizedBox(height: KSpace.stackGap),
        _expenseCard(
          profitPos ? MSym.trendingUp : MSym.trendingDown,
          profitPos ? TW.emerald600 : TW.rose600,
          profitPos ? TW.emerald100 : TW.rose100,
          'Net Profit',
          _loading ? '...' : '${profitPos ? '' : '-'}${rupees(_netProfit.abs())}',
          'This Month',
          valueColor: profitPos ? TW.emerald600 : TW.rose600,
          full: true,
        ),
      ],
    );
  }

  Widget _expenseCard(IconData icon, Color fg, Color bg, String label, String value, String tag, {Color? valueColor, bool full = false}) {
    final c = context.c;
    return KCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
              child: Sym(icon, size: 22, color: fg),
            ),
            const Spacer(),
            Pill(tag, fg: fg, bg: bg.withValues(alpha: 0.4)),
          ]),
          const SizedBox(height: 14),
          Text(label.toUpperCase(), style: KText.labelCaps.copyWith(color: c.onSurfaceVariant, letterSpacing: 0.5)),
          const SizedBox(height: 4),
          Text(value, style: KText.statValue.copyWith(color: valueColor ?? c.onSurface)),
        ],
      ),
    );
  }

  Widget _todaysAttendance() {
    final c = context.c;
    return KCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(color: c.secondaryContainer.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(12)),
                child: Sym(MSym.calendarToday, size: 20, color: c.secondary, fill: true),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Today's Attendance", style: KText.h3.copyWith(color: c.onSurface)),
                    Text(DateFormat('EEEE, d MMMM yyyy').format(DateTime.now()),
                        style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                decoration: BoxDecoration(color: c.secondaryContainer.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(999)),
                child: Text(_loading ? '...' : '$_dailyAttendance',
                    style: TextStyle(color: c.secondary, fontWeight: FontWeight.w700, fontSize: 18)),
              ),
            ]),
          ),
          Divider(height: 1, color: c.outlineVariant.withValues(alpha: 0.2)),
          if (_loading)
            const KLoading(label: 'Loading attendance...')
          else if (_todayAttendance.isEmpty)
            const KEmpty(icon: MSym.eventBusy, message: 'No check-ins recorded today yet.')
          else
            ..._todayAttendance.take(5).map((a) => _attRow(a)),
        ],
      ),
    );
  }

  Widget _attRow(Map<String, dynamic> a) {
    final c = context.c;
    final name = a['memberName'] as String?;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: Row(children: [
        InitialAvatar(name: name, size: 32, bg: c.primaryContainer, fg: c.primary),
        const SizedBox(width: 12),
        Expanded(child: Text(name ?? '—', style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w500, fontSize: 14))),
        Text(fmtTime(a['checkInTime'] ?? a['timestamp']), style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
        const SizedBox(width: 10),
        const Pill('Checked In', fg: TW.emerald600, bg: TW.emerald50, dot: true),
      ]),
    );
  }

  Widget _expiringAlert() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: TW.amber50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: TW.amber200),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Sym(MSym.warning, size: 22, color: TW.amber600, fill: true),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${_expiringSoon.length} member${_expiringSoon.length > 1 ? 's' : ''} expiring within 7 days',
                    style: const TextStyle(color: TW.amber800, fontWeight: FontWeight.w500)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8, runSpacing: 8,
                  children: _expiringSoon.map((m) => Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: TW.amber100, borderRadius: BorderRadius.circular(999), border: Border.all(color: TW.amber200)),
                    child: Text('${m['name']} — ${m['expiryDate']}', style: const TextStyle(color: TW.amber700, fontSize: 12)),
                  )).toList(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _chartCard(String title, Widget child) {
    final c = context.c;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: KText.h3.copyWith(color: c.onSurface)),
          const SizedBox(height: 20),
          child,
        ],
      ),
    );
  }

  Widget _revenueTrendChart() {
    final spots = [for (var i = 0; i < _revenueTrend.length; i++) FlSpot(i.toDouble(), _revenueTrend[i].y.toDouble())];
    return LineChart(LineChartData(
      gridData: const FlGridData(show: false),
      titlesData: FlTitlesData(
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 44, getTitlesWidget: (v, _) => Text('₹${v.toInt()}', style: const TextStyle(color: TW.slate400, fontSize: 10)))),
        bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, interval: (_revenueTrend.length / 4).ceilToDouble().clamp(1, 999), getTitlesWidget: (v, _) {
          final i = v.toInt();
          if (i < 0 || i >= _revenueTrend.length) return const SizedBox();
          return Padding(padding: const EdgeInsets.only(top: 6), child: Text(_revenueTrend[i].x, style: const TextStyle(color: TW.slate400, fontSize: 10)));
        })),
      ),
      borderData: FlBorderData(show: false),
      lineBarsData: [
        LineChartBarData(
          spots: spots,
          isCurved: true,
          color: TW.violet600,
          barWidth: 2,
          dotData: const FlDotData(show: false),
          belowBarData: BarAreaData(show: true, gradient: LinearGradient(
            begin: Alignment.topCenter, end: Alignment.bottomCenter,
            colors: [TW.violet600.withValues(alpha: 0.7), TW.violet600.withValues(alpha: 0)],
          )),
        ),
      ],
    ));
  }

  Widget _membershipPie() {
    final expired = (_totalMembers - _activeMembers).clamp(0, _totalMembers);
    return Stack(
      alignment: Alignment.center,
      children: [
        PieChart(PieChartData(
          sectionsSpace: 4,
          centerSpaceRadius: 55,
          sections: [
            PieChartSectionData(value: _activeMembers.toDouble(), color: TW.violet600, radius: 20, showTitle: false),
            PieChartSectionData(value: expired.toDouble(), color: TW.amber500, radius: 20, showTitle: false),
          ],
        )),
        Column(mainAxisSize: MainAxisSize.min, children: [
          Text('$_totalMembers', style: KText.statValue.copyWith(color: context.c.onSurface)),
          Text('Total', style: KText.labelCaps.copyWith(color: context.c.onSurfaceVariant)),
        ]),
        Positioned(
          bottom: 0,
          child: Row(mainAxisSize: MainAxisSize.min, children: const [
            _Legend(color: TW.violet600, label: 'Active'),
            SizedBox(width: 16),
            _Legend(color: TW.amber500, label: 'Expired'),
          ]),
        ),
      ],
    );
  }

  Widget _revVsExpChart() {
    final maxY = _revVsExp.fold<double>(0, (m, b) => [m, b.rev.toDouble(), b.exp.toDouble()].reduce((a, c) => a > c ? a : c));
    return BarChart(BarChartData(
      maxY: maxY == 0 ? 10 : maxY * 1.2,
      gridData: FlGridData(show: true, drawVerticalLine: false, getDrawingHorizontalLine: (_) => FlLine(color: TW.slate400.withValues(alpha: 0.15), strokeWidth: 1)),
      borderData: FlBorderData(show: false),
      titlesData: FlTitlesData(
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 44, getTitlesWidget: (v, _) => Text('₹${v.toInt()}', style: const TextStyle(color: TW.slate400, fontSize: 10)))),
        bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, getTitlesWidget: (v, _) {
          final i = v.toInt();
          if (i < 0 || i >= _revVsExp.length) return const SizedBox();
          return Padding(padding: const EdgeInsets.only(top: 6), child: Text(_revVsExp[i].label, style: const TextStyle(color: TW.slate400, fontSize: 10)));
        })),
      ),
      barGroups: [
        for (var i = 0; i < _revVsExp.length; i++)
          BarChartGroupData(x: i, barsSpace: 4, barRods: [
            BarChartRodData(toY: _revVsExp[i].rev.toDouble(), color: TW.violet600, width: 8, borderRadius: BorderRadius.circular(2)),
            BarChartRodData(toY: _revVsExp[i].exp.toDouble(), color: TW.rose500, width: 8, borderRadius: BorderRadius.circular(2)),
          ]),
      ],
    ));
  }

  Widget _revByPlanChart() {
    final maxY = _revenueByPlan.fold<double>(0, (m, e) => e.y > m ? e.y.toDouble() : m);
    return BarChart(BarChartData(
      maxY: maxY == 0 ? 10 : maxY * 1.2,
      gridData: FlGridData(show: true, drawVerticalLine: false, getDrawingHorizontalLine: (_) => FlLine(color: TW.slate400.withValues(alpha: 0.15), strokeWidth: 1)),
      borderData: FlBorderData(show: false),
      titlesData: FlTitlesData(
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 44, getTitlesWidget: (v, _) => Text('₹${v.toInt()}', style: const TextStyle(color: TW.slate400, fontSize: 10)))),
        bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, getTitlesWidget: (v, _) {
          final i = v.toInt();
          if (i < 0 || i >= _revenueByPlan.length) return const SizedBox();
          final label = _revenueByPlan[i].x;
          return Padding(padding: const EdgeInsets.only(top: 6), child: Text(label.length > 6 ? label.substring(0, 6) : label, style: const TextStyle(color: TW.slate400, fontSize: 9)));
        })),
      ),
      barGroups: [
        for (var i = 0; i < _revenueByPlan.length; i++)
          BarChartGroupData(x: i, barRods: [
            BarChartRodData(toY: _revenueByPlan[i].y.toDouble(), color: TW.violet600, width: 16, borderRadius: const BorderRadius.vertical(top: Radius.circular(6))),
          ]),
      ],
    ));
  }

  Widget _recentActivity() {
    final c = context.c;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Recent Activity', style: KText.h3.copyWith(color: c.onSurface)),
          const SizedBox(height: 20),
          if (_loading)
            Text('Loading activity...', style: TextStyle(color: c.onSurfaceVariant))
          else if (_recent.isEmpty)
            Text('No recent activity.', style: TextStyle(color: c.onSurfaceVariant))
          else
            ..._recent.map((a) {
              final isPay = a.type == 'payment';
              return Padding(
                padding: const EdgeInsets.only(bottom: 18),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      color: (isPay ? c.primaryContainer : c.secondaryContainer).withValues(alpha: 0.4),
                      shape: BoxShape.circle,
                    ),
                    child: Sym(isPay ? MSym.payments : MSym.howToReg, size: 18, color: isPay ? c.primary : c.secondary, fill: true),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(a.title, style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w500, fontSize: 14)),
                      const SizedBox(height: 2),
                      Text(a.date == null ? '' : '${DateFormat('d MMM').format(a.date!)} · ${DateFormat('h:mm a').format(a.date!)}',
                          style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
                    ]),
                  ),
                ]),
              );
            }),
        ],
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  final Color color;
  final String label;
  const _Legend({required this.color, required this.label});
  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      const SizedBox(width: 6),
      Text(label, style: TextStyle(color: context.c.onSurfaceVariant, fontSize: 12)),
    ]);
  }
}

class _XY {
  final String x;
  final num y;
  _XY(this.x, this.y);
}

class _Bar {
  final String label;
  final num rev, exp;
  _Bar(this.label, this.rev, this.exp);
}

class _Activity {
  final String type;
  final String title;
  final DateTime? date;
  _Activity(this.type, this.title, this.date);
}
