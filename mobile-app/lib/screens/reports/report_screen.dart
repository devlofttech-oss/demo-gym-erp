import 'dart:typed_data';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key});
  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  DateTime _month = DateTime.now();
  List<Map<String, dynamic>> _payments = [];
  List<Map<String, dynamic>> _members = [];
  List<Map<String, dynamic>> _attendance = [];
  bool _loading = false;
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  String get _monthPrefix =>
      '${_month.year}-${_month.month.toString().padLeft(2, '0')}';

  String get _monthLabel => DateFormat('MMMM yyyy').format(_month);

  void _prevMonth() {
    setState(() => _month = DateTime(_month.year, _month.month - 1));
    _fetch();
  }

  void _nextMonth() {
    if (_month.year >= DateTime.now().year && _month.month >= DateTime.now().month) return;
    setState(() => _month = DateTime(_month.year, _month.month + 1));
    _fetch();
  }

  Future<void> _fetch() async {
    final gymId = context.read<AuthProvider>().gymId;
    if (mounted) setState(() => _loading = true);
    try {
      final prefix = _monthPrefix;
      final res = await Future.wait([
        TenantDb.getCollection(gymId, 'payments'),
        TenantDb.getCollection(gymId, 'members'),
        TenantDb.getCollection(gymId, 'attendance'),
      ]);
      if (mounted) {
        setState(() {
          _payments = res[0]
              .where((p) => (p['date'] as String? ?? '').startsWith(prefix))
              .toList();
          _members = res[1]
              .where((m) => (m['joinDate'] as String? ?? '').startsWith(prefix))
              .toList();
          _attendance = res[2]
              .where((a) {
                final d = recordDate(a);
                return d != null && d.startsWith(prefix);
              })
              .toList();
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  // Computed stats
  double get _revenue =>
      _payments.fold(0.0, (s, p) => s + asNum(p['amount']));

  int get _newMembers => _members.length;

  int get _renewals =>
      _payments.where((p) => (p['type'] ?? '') == 'Renewal').length;

  Map<int, double> get _dailyRevenue {
    final map = <int, double>{};
    for (final p in _payments) {
      final d = DateTime.tryParse(p['date'] ?? '');
      if (d == null) continue;
      map[d.day] = (map[d.day] ?? 0) + asNum(p['amount']);
    }
    return map;
  }

  int get _daysInMonth =>
      DateTime(_month.year, _month.month + 1, 0).day;

  double get _avgDailyAttendance {
    if (_daysInMonth == 0) return 0;
    return _attendance.length / _daysInMonth;
  }

  Future<void> _exportPdf() async {
    setState(() => _exporting = true);
    try {
      final bytes = await _buildPdf();
      await Printing.sharePdf(
          bytes: bytes, filename: 'kilos_report_$_monthPrefix.pdf');
    } catch (_) {}
    if (mounted) setState(() => _exporting = false);
  }

  Future<Uint8List> _buildPdf() async {
    final doc = pw.Document();
    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        build: (ctx) => [
          pw.Header(
            level: 0,
            child: pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text('Monthly Report',
                    style: pw.TextStyle(
                        fontSize: 24, fontWeight: pw.FontWeight.bold)),
                pw.Text(_monthLabel,
                    style: pw.TextStyle(fontSize: 14, color: PdfColors.grey700)),
              ],
            ),
          ),
          pw.SizedBox(height: 24),
          pw.Text('Summary',
              style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 12),
          pw.Row(children: [
            _pdfStat('Total Revenue', '₹${grouped(_revenue)}'),
            pw.SizedBox(width: 16),
            _pdfStat('New Members', '$_newMembers'),
            pw.SizedBox(width: 16),
            _pdfStat('Renewals', '$_renewals'),
            pw.SizedBox(width: 16),
            _pdfStat('Avg Daily Attendance', _avgDailyAttendance.toStringAsFixed(1)),
          ]),
          pw.SizedBox(height: 24),
          pw.Text('Payments (${_payments.length})',
              style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 8),
          if (_payments.isNotEmpty)
            pw.Table(
              border: pw.TableBorder.all(color: PdfColors.grey300),
              children: [
                pw.TableRow(
                  decoration: const pw.BoxDecoration(color: PdfColors.grey200),
                  children: ['Date', 'Member', 'Plan', 'Amount', 'Mode']
                      .map((h) => pw.Padding(
                            padding: const pw.EdgeInsets.all(6),
                            child: pw.Text(h,
                                style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10)),
                          ))
                      .toList(),
                ),
                ..._payments.map((p) => pw.TableRow(
                      children: [
                        p['date'] ?? '',
                        p['memberName'] ?? '',
                        p['planName'] ?? '',
                        '₹${grouped(asNum(p['amount']))}',
                        p['paymentMode'] ?? '',
                      ]
                          .map((v) => pw.Padding(
                                padding: const pw.EdgeInsets.all(6),
                                child: pw.Text(v, style: const pw.TextStyle(fontSize: 10)),
                              ))
                          .toList(),
                    )),
              ],
            ),
          if (_payments.isEmpty) pw.Text('No payments this month.'),
          pw.SizedBox(height: 24),
          pw.Text('New Members (${_members.length})',
              style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 8),
          if (_members.isNotEmpty)
            pw.Table(
              border: pw.TableBorder.all(color: PdfColors.grey300),
              children: [
                pw.TableRow(
                  decoration: const pw.BoxDecoration(color: PdfColors.grey200),
                  children: ['Name', 'Phone', 'Plan', 'Join Date']
                      .map((h) => pw.Padding(
                            padding: const pw.EdgeInsets.all(6),
                            child: pw.Text(h,
                                style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10)),
                          ))
                      .toList(),
                ),
                ..._members.map((m) => pw.TableRow(
                      children: [
                        m['name'] ?? '',
                        m['phone'] ?? '',
                        m['planName'] ?? '',
                        m['joinDate'] ?? '',
                      ]
                          .map((v) => pw.Padding(
                                padding: const pw.EdgeInsets.all(6),
                                child: pw.Text(v, style: const pw.TextStyle(fontSize: 10)),
                              ))
                          .toList(),
                    )),
              ],
            ),
          if (_members.isEmpty) pw.Text('No new members this month.'),
        ],
      ),
    );
    return doc.save();
  }

  pw.Widget _pdfStat(String label, String value) {
    return pw.Expanded(
      child: pw.Container(
        padding: const pw.EdgeInsets.all(12),
        decoration: pw.BoxDecoration(
          border: pw.Border.all(color: PdfColors.grey300),
          borderRadius: pw.BorderRadius.circular(8),
        ),
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(value,
                style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 4),
            pw.Text(label,
                style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey700)),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final daily = _dailyRevenue;
    final days = _daysInMonth;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        leading: IconButton(
          icon: Sym(MSym.arrowBack, size: 20, color: c.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Reports', style: KText.h3.copyWith(color: c.onSurface)),
        actions: [
          IconButton(
            icon: _exporting
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: c.primary))
                : Sym(MSym.uploadFile, color: c.primary),
            tooltip: 'Export PDF',
            onPressed: _exporting ? null : _exportPdf,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetch,
        child: CustomScrollView(
          slivers: [
            // Month picker
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      icon: Sym(MSym.chevronLeft, color: c.onSurface),
                      onPressed: _prevMonth,
                    ),
                    const SizedBox(width: 8),
                    Text(_monthLabel,
                        style: KText.h3.copyWith(color: c.onSurface)),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: Sym(MSym.chevronRight,
                          color: (_month.year >= DateTime.now().year &&
                                  _month.month >= DateTime.now().month)
                              ? TW.slate400
                              : c.onSurface),
                      onPressed: _nextMonth,
                    ),
                  ],
                ),
              ),
            ),
            if (_loading)
              const SliverFillRemaining(child: KLoading())
            else ...[
              // Summary cards
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          _StatCard('Revenue', '₹${grouped(_revenue)}',
                              TW.emerald600, MSym.payments),
                          const SizedBox(width: 10),
                          _StatCard('New Members', '$_newMembers',
                              TW.blue600, MSym.personAdd),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _StatCard('Renewals', '$_renewals',
                              TW.violet600, MSym.autorenew),
                          const SizedBox(width: 10),
                          _StatCard('Avg Daily Attendance',
                              _avgDailyAttendance.toStringAsFixed(1),
                              TW.amber600, MSym.eventAvailable),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              // Daily revenue bar chart
              if (daily.isNotEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Daily Revenue',
                            style:
                                KText.labelCaps.copyWith(color: c.onSurfaceVariant)),
                        const SizedBox(height: 8),
                        KCard(
                          child: SizedBox(
                            height: 180,
                            child: BarChart(
                              BarChartData(
                                gridData: FlGridData(
                                  show: true,
                                  drawVerticalLine: false,
                                  horizontalInterval: (_revenue / 4).clamp(1, double.infinity),
                                  getDrawingHorizontalLine: (_) => FlLine(
                                    color: c.outlineVariant.withValues(alpha: 0.4),
                                    strokeWidth: 1,
                                  ),
                                ),
                                borderData: FlBorderData(show: false),
                                titlesData: FlTitlesData(
                                  leftTitles: AxisTitles(
                                    sideTitles: SideTitles(
                                      showTitles: true,
                                      reservedSize: 44,
                                      getTitlesWidget: (v, _) => Text(
                                        grouped(v),
                                        style: TextStyle(
                                            color: c.onSurfaceVariant,
                                            fontSize: 9),
                                      ),
                                    ),
                                  ),
                                  bottomTitles: AxisTitles(
                                    sideTitles: SideTitles(
                                      showTitles: true,
                                      getTitlesWidget: (v, _) {
                                        final day = v.toInt();
                                        if (day % 5 != 0 && day != 1) {
                                          return const SizedBox.shrink();
                                        }
                                        return Text(
                                          '$day',
                                          style: TextStyle(
                                              color: c.onSurfaceVariant,
                                              fontSize: 9),
                                        );
                                      },
                                    ),
                                  ),
                                  topTitles: AxisTitles(
                                      sideTitles: SideTitles(showTitles: false)),
                                  rightTitles: AxisTitles(
                                      sideTitles: SideTitles(showTitles: false)),
                                ),
                                barGroups: List.generate(
                                  days,
                                  (i) => BarChartGroupData(
                                    x: i + 1,
                                    barRods: [
                                      BarChartRodData(
                                        toY: (daily[i + 1] ?? 0).toDouble(),
                                        color: c.primary,
                                        width: (MediaQuery.of(context).size.width - 100) / days,
                                        borderRadius: const BorderRadius.vertical(
                                            top: Radius.circular(4)),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              // Payments list
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Text('Payments (${_payments.length})',
                      style: KText.labelCaps.copyWith(color: c.onSurfaceVariant)),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 8)),
              if (_payments.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                    child: KCard(
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text('No payments this month',
                              style: KText.bodyMd
                                  .copyWith(color: c.onSurfaceVariant)),
                        ),
                      ),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (_, i) {
                        final p = _payments[i];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: KCard(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 10),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(p['memberName'] ?? '',
                                          style: KText.bodyMd.copyWith(
                                              color: c.onSurface,
                                              fontWeight: FontWeight.w600)),
                                      Text(p['date'] ?? '',
                                          style: KText.bodyMd.copyWith(
                                              color: c.onSurfaceVariant)),
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text('₹${grouped(asNum(p['amount']))}',
                                        style: KText.bodyMd.copyWith(
                                            color: TW.emerald600,
                                            fontWeight: FontWeight.w700)),
                                    Text(p['paymentMode'] ?? '',
                                        style: KText.bodyMd.copyWith(
                                            color: c.onSurfaceVariant,
                                            fontSize: 11)),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                      childCount: _payments.length,
                    ),
                  ),
                ),
              // New members list
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Text('New Members (${_members.length})',
                      style: KText.labelCaps.copyWith(color: c.onSurfaceVariant)),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 8)),
              if (_members.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                    child: KCard(
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text('No new members this month',
                              style: KText.bodyMd
                                  .copyWith(color: c.onSurfaceVariant)),
                        ),
                      ),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (_, i) {
                        final m = _members[i];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: KCard(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 10),
                            child: Row(
                              children: [
                                InitialAvatar(
                                    name: m['name'] as String?,
                                    size: 36,
                                    bg: c.primaryContainer,
                                    fg: c.primary),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(m['name'] ?? '',
                                          style: KText.bodyMd.copyWith(
                                              color: c.onSurface,
                                              fontWeight: FontWeight.w600)),
                                      Text(m['phone'] ?? '',
                                          style: KText.bodyMd.copyWith(
                                              color: c.onSurfaceVariant)),
                                    ],
                                  ),
                                ),
                                Text(m['joinDate'] ?? '',
                                    style: KText.bodyMd.copyWith(
                                        color: c.onSurfaceVariant, fontSize: 11)),
                              ],
                            ),
                          ),
                        );
                      },
                      childCount: _members.length,
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  const _StatCard(this.label, this.value, this.color, this.icon);

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Expanded(
      child: KCard(
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Sym(icon, color: color, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(value,
                      style: KText.bodyLg.copyWith(
                          color: c.onSurface,
                          fontWeight: FontWeight.w700,
                          fontSize: 16),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                  Text(label,
                      style: KText.bodyMd.copyWith(
                          color: c.onSurfaceVariant, fontSize: 11),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
