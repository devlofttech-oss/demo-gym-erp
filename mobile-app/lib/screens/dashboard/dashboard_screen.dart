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
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Text('Dashboard', style: KText.h2.copyWith(color: c.onSurface)),
          const SizedBox(height: 2),
          Text("Here's what's happening today.", style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
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

  Widget _kpiGrid() {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.3,
      children: [
        _bentoCard(
          icon: MSym.accountBalanceWallet,
          iconBg: KD.primaryTint,
          iconColor: KD.primary,
          label: 'Total Revenue',
          value: _loading ? '...' : rupees(_revenue),
          sub: 'All time',
          subColor: KD.teal,
        ),
        _bentoCard(
          icon: MSym.showChart,
          iconBg: const Color(0xFFCCF5F1),
          iconColor: KD.teal,
          label: 'Monthly Revenue',
          value: _loading ? '...' : rupees(_monthlyRevenue),
          sub: 'This month',
          subColor: KD.teal,
        ),
        _bentoCard(
          icon: MSym.group,
          iconBg: KD.primaryTint,
          iconColor: KD.primary,
          label: 'Active Members',
          value: _loading ? '...' : '$_activeMembers',
          sub: _loading ? '—' : 'of $_totalMembers total',
          subColor: KD.inkSoft,
        ),
        _bentoCard(
          icon: MSym.howToReg,
          iconBg: KD.coralTint,
          iconColor: KD.coral,
          label: "Today's Check-ins",
          value: _loading ? '...' : '$_dailyAttendance',
          sub: 'Today',
          subColor: KD.coral,
        ),
      ],
    );
  }

  Widget _bentoCard({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String label,
    required String value,
    required String sub,
    required Color subColor,
  }) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(20),
        boxShadow: kCardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38, height: 38,
            decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(12)),
            child: Sym(icon, size: 20, color: iconColor, fill: true),
          ),
          const Spacer(),
          Text(value,
              style: KText.statValue.copyWith(color: c.onSurface, fontSize: 24),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
          const SizedBox(height: 2),
          Text(label,
              style: TextStyle(color: c.onSurfaceVariant, fontSize: 11.5, fontWeight: FontWeight.w500),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
          const SizedBox(height: 4),
          Text(sub, style: TextStyle(color: subColor, fontSize: 11, fontWeight: FontWeight.w600)),
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
          else ...[
            ..._todayAttendance.take(5).map((a) => _attRow(a)),
            if (_todayAttendance.length > 5) ...[
              Divider(height: 1, color: c.outlineVariant.withValues(alpha: 0.2)),
              TextButton(
                onPressed: _showAllAttendance,
                child: Text('View all ${_todayAttendance.length} check-ins',
                    style: TextStyle(color: c.primary, fontWeight: FontWeight.w600)),
              ),
            ],
          ],
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

  void _showAllAttendance() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.c.surfaceContainerLowest,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        final c = ctx.c;
        return DraggableScrollableSheet(
          initialChildSize: 0.6,
          maxChildSize: 0.9,
          minChildSize: 0.3,
          expand: false,
          builder: (_, scroll) => Column(children: [
            const SizedBox(height: 12),
            Container(width: 36, height: 4, decoration: BoxDecoration(color: c.outlineVariant, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(children: [
                Text("Today's Attendance", style: KText.h3.copyWith(color: c.onSurface)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(color: c.secondaryContainer.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(99)),
                  child: Text('${_todayAttendance.length}', style: TextStyle(color: c.secondary, fontWeight: FontWeight.w700)),
                ),
              ]),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.separated(
                controller: scroll,
                itemCount: _todayAttendance.length,
                separatorBuilder: (_, _) => Divider(height: 1, color: c.outlineVariant.withValues(alpha: 0.2)),
                itemBuilder: (_, i) => _attRow(_todayAttendance[i]),
              ),
            ),
          ]),
        );
      },
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

  String _relativeTime(DateTime? dt) {
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('d MMM').format(dt);
  }

  Widget _recentActivity() {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: c.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(20),
        boxShadow: kCardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Recent Activity', style: KText.h3.copyWith(color: c.onSurface, fontSize: 17)),
          const SizedBox(height: 16),
          if (_loading)
            const KLoading()
          else if (_recent.isEmpty)
            Text('No recent activity.', style: TextStyle(color: c.onSurfaceVariant))
          else
            ..._recent.map((a) {
              final isPay = a.type == 'payment';
              final initials = a.title.isNotEmpty
                  ? a.title.split(' ').take(2).map((w) => w.isEmpty ? '' : w[0].toUpperCase()).join()
                  : '?';
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                  Container(
                    width: 38, height: 38,
                    decoration: BoxDecoration(
                      color: isPay ? KD.primaryTint : KD.coralTint,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(initials,
                          style: TextStyle(
                            color: isPay ? KD.primary : KD.coral,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          )),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(a.title,
                          style: const TextStyle(color: KD.ink, fontWeight: FontWeight.w500, fontSize: 13.5),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 1),
                      Text(_relativeTime(a.date),
                          style: const TextStyle(color: KD.inkSoft, fontSize: 11.5)),
                    ]),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isPay ? KD.primaryTint : KD.coralTint,
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(
                      isPay ? 'Payment' : 'Check-in',
                      style: TextStyle(
                        color: isPay ? KD.primary : KD.coral,
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
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
