import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

const _pageSize = 30;

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});
  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  List<Map<String, dynamic>> _records = [];
  bool _loading = true;
  String _dateFilter = 'today';
  String _customDate = todayStr();
  String? _selectedDay;
  String _search = '';
  int _page = 1;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    final gymId = context.read<AuthProvider>().gymId;
    try {
      final data = await TenantDb.getCollection(gymId, 'attendance');
      data.sort((a, b) {
        final da = toDate(a['checkInTime'] ?? a['timestamp'] ?? a['date']) ?? DateTime(1970);
        final db = toDate(b['checkInTime'] ?? b['timestamp'] ?? b['date']) ?? DateTime(1970);
        return db.compareTo(da);
      });
      if (mounted) setState(() => _records = data);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _filtered {
    final today = todayStr();
    final now = DateTime.now();
    final weekStart = DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: (now.weekday - 1) % 7))
        .toIso8601String().split('T').first;
    final monthStart = DateTime(now.year, now.month, 1).toIso8601String().split('T').first;
    final term = _search.toLowerCase();
    return _records.where((a) {
      final d = recordDate(a);
      if (d == null) return false;
      var matchDate = true;
      if (_dateFilter == 'today') matchDate = d == today;
      else if (_dateFilter == 'week') matchDate = d.compareTo(weekStart) >= 0 && d.compareTo(today) <= 0;
      else if (_dateFilter == 'month') matchDate = d.compareTo(monthStart) >= 0;
      else if (_dateFilter == 'custom') matchDate = d == _customDate;
      if (matchDate && _selectedDay != null) matchDate = d == _selectedDay;
      final matchTerm = term.isEmpty || ((a['memberName'] as String?)?.toLowerCase().contains(term) ?? false);
      return matchDate && matchTerm;
    }).toList();
  }

  List<String> _weekDays() {
    final now = DateTime.now();
    final monday = DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: (now.weekday - 1) % 7));
    return List.generate(7, (i) {
      final d = monday.add(Duration(days: i));
      return d.toIso8601String().split('T').first;
    });
  }

  List<String> _monthDays() {
    final now = DateTime.now();
    return List.generate(now.day, (i) {
      final d = DateTime(now.year, now.month, i + 1);
      return d.toIso8601String().split('T').first;
    });
  }

  int _countForDay(String isoDay) =>
      _records.where((a) => recordDate(a) == isoDay).length;

  int get _totalToday => _records.where((a) => recordDate(a) == todayStr()).length;
  int get _totalMonth {
    final monthStart = DateTime(DateTime.now().year, DateTime.now().month, 1).toIso8601String().split('T').first;
    return _records.where((a) { final d = recordDate(a); return d != null && d.compareTo(monthStart) >= 0; }).length;
  }

  String _dateLabel(String iso) {
    final today = todayStr();
    final yesterday = DateTime.now().subtract(const Duration(days: 1)).toIso8601String().split('T').first;
    if (iso == today) return 'Today';
    if (iso == yesterday) return 'Yesterday';
    final d = DateTime.tryParse(iso);
    return d == null ? iso : DateFormat('EEEE, d MMMM yyyy').format(d);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final filtered = _filtered;
    final totalPages = (filtered.length / _pageSize).ceil();
    final paginated = filtered.skip((_page - 1) * _pageSize).take(_pageSize).toList();

    return RefreshIndicator(
      onRefresh: () async { setState(() => _loading = true); await _fetch(); },
      child: ListView(
        padding: const EdgeInsets.all(KSpace.gutter),
        children: [
          Text('Attendance Log', style: KText.h1.copyWith(color: c.onSurface)),
          const SizedBox(height: 6),
          Text('All member check-ins sorted by date.', style: KText.bodyLg.copyWith(color: c.onSurfaceVariant)),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: _kpi("Today's Check-ins", '$_totalToday', MSym.today, c.primary, c.primary.withValues(alpha: 0.1))),
            const SizedBox(width: 12),
            Expanded(child: _kpi('This Month', '$_totalMonth', MSym.calendarMonth, TW.emerald600, TW.emerald50)),
          ]),
          const SizedBox(height: 12),
          _kpi('Total Records', '${_records.length}', MSym.eventAvailable, TW.violet600, TW.violet50),
          const SizedBox(height: 16),
          _dateTabs(),
          if (_dateFilter == 'week' || _dateFilter == 'month') ...[
            const SizedBox(height: 8),
            _dayChips(),
          ],
          const SizedBox(height: 12),
          _searchBar(),
          const SizedBox(height: 16),
          if (_loading) const KLoading(label: 'Loading attendance...')
          else if (paginated.isEmpty) const KEmpty(icon: MSym.eventBusy, message: 'No check-ins found')
          else _groupedList(paginated),
          if (!_loading && totalPages > 1) _pagination(totalPages),
        ],
      ),
    );
  }

  Widget _kpi(String label, String value, IconData icon, Color fg, Color bg) {
    final c = context.c;
    return KCard(
      padding: const EdgeInsets.all(16),
      child: Row(children: [
        Container(
          width: 48, height: 48,
          decoration: BoxDecoration(color: bg.withValues(alpha: context.isDark ? 0.2 : 1), borderRadius: BorderRadius.circular(12)),
          child: Sym(icon, size: 24, color: fg, fill: true),
        ),
        const SizedBox(width: 12),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w700, fontSize: 22)),
          Text(label, style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
        ]),
      ]),
    );
  }

  Widget _dateTabs() {
    const filters = [('today', 'Today'), ('week', 'This Week'), ('month', 'This Month'), ('all', 'All Time'), ('custom', 'Custom')];
    final c = context.c;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: c.surfaceContainer, borderRadius: BorderRadius.circular(12)),
        child: Row(children: filters.map((f) {
          final active = _dateFilter == f.$1;
          return GestureDetector(
            onTap: () async {
              if (f.$1 == 'custom') {
                final picked = await showDatePicker(context: context, initialDate: DateTime.tryParse(_customDate) ?? DateTime.now(), firstDate: DateTime(2020), lastDate: DateTime(2100));
                if (picked != null) _customDate = picked.toIso8601String().split('T').first;
              }
              setState(() { _dateFilter = f.$1; _selectedDay = null; _page = 1; });
            },
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 2),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(color: active ? c.surfaceContainerLowest : Colors.transparent, borderRadius: BorderRadius.circular(8)),
              child: Text(f.$2, style: TextStyle(color: active ? c.onSurface : c.onSurfaceVariant, fontWeight: FontWeight.w500, fontSize: 13)),
            ),
          );
        }).toList()),
      ),
    );
  }

  Widget _dayChips() {
    final c = context.c;
    final days = _dateFilter == 'week' ? _weekDays() : _monthDays();
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: days.map((iso) {
          final d = DateTime.tryParse(iso);
          if (d == null) return const SizedBox.shrink();
          final count = _countForDay(iso);
          final isSelected = _selectedDay == iso;
          final dayLabel = DateFormat('E').format(d).substring(0, 1);
          final dateNum = d.day.toString();
          return GestureDetector(
            onTap: () => setState(() {
              _selectedDay = isSelected ? null : iso;
              _page = 1;
            }),
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected ? c.primary : c.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: isSelected ? c.primary : c.outlineVariant.withValues(alpha: 0.3)),
              ),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Text(dayLabel, style: TextStyle(color: isSelected ? c.onPrimary : c.onSurfaceVariant, fontSize: 11, fontWeight: FontWeight.w600)),
                Text(dateNum, style: TextStyle(color: isSelected ? c.onPrimary : c.onSurface, fontSize: 14, fontWeight: FontWeight.w700)),
                if (count > 0)
                  Container(
                    margin: const EdgeInsets.only(top: 3),
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                    decoration: BoxDecoration(
                      color: isSelected ? c.onPrimary.withValues(alpha: 0.25) : c.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text('$count', style: TextStyle(color: isSelected ? c.onPrimary : c.primary, fontSize: 10, fontWeight: FontWeight.w700)),
                  )
                else
                  const SizedBox(height: 14),
              ]),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _searchBar() {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(color: c.surfaceContainerLowest, borderRadius: BorderRadius.circular(12), border: Border.all(color: c.outlineVariant.withValues(alpha: 0.3))),
      child: Row(children: [
        Sym(MSym.search, size: 18, color: c.onSurfaceVariant),
        const SizedBox(width: 8),
        Expanded(child: TextField(
          controller: _searchCtrl,
          onChanged: (v) => setState(() { _search = v; _page = 1; }),
          style: TextStyle(color: c.onSurface, fontSize: 14),
          decoration: InputDecoration(isDense: true, border: InputBorder.none, hintText: 'Search member name...', hintStyle: TextStyle(color: c.onSurfaceVariant)),
        )),
        if (_search.isNotEmpty) GestureDetector(onTap: () { _searchCtrl.clear(); setState(() => _search = ''); }, child: Sym(MSym.close, size: 16, color: c.onSurfaceVariant)),
      ]),
    );
  }

  Widget _groupedList(List<Map<String, dynamic>> rows) {
    final c = context.c;
    final widgets = <Widget>[];
    String? prevDate;
    for (final a in rows) {
      final d = recordDate(a);
      if (d != prevDate) {
        widgets.add(Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 6),
          child: Text(d != null ? _dateLabel(d).toUpperCase() : 'UNKNOWN DATE',
              style: KText.labelCaps.copyWith(color: c.onSurfaceVariant, letterSpacing: 1)),
        ));
        prevDate = d;
      }
      widgets.add(_row(a));
    }
    return KCard(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: widgets));
  }

  Widget _row(Map<String, dynamic> a) {
    final c = context.c;
    final out = a['checkOutTime'] != null;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(children: [
        InitialAvatar(name: a['memberName'] as String?, size: 36, bg: c.primaryContainer, fg: c.primary),
        const SizedBox(width: 12),
        Expanded(child: Text((a['memberName'] as String?) ?? 'Unknown', style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w500, fontSize: 14))),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Row(children: [
            Container(width: 8, height: 8, decoration: const BoxDecoration(color: TW.emerald500, shape: BoxShape.circle)),
            const SizedBox(width: 4),
            Text(fmtTime(a['checkInTime'] ?? a['timestamp']), style: const TextStyle(color: TW.emerald600, fontWeight: FontWeight.w500, fontSize: 13)),
          ]),
          const SizedBox(height: 2),
          if (out)
            Text('${fmtTime(a['checkOutTime'])} · ${fmtDuration(a['duration'])}', style: const TextStyle(color: TW.rose500, fontSize: 12))
          else
            const Pill('Active', fg: TW.amber600, bg: TW.amber50),
        ]),
      ]),
    );
  }

  Widget _pagination(int totalPages) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        IconButton(onPressed: _page > 1 ? () => setState(() => _page--) : null, icon: Sym(MSym.chevronLeft, size: 20, color: c.onSurfaceVariant)),
        Text('Page $_page of $totalPages', style: TextStyle(color: c.onSurfaceVariant, fontSize: 13)),
        IconButton(onPressed: _page < totalPages ? () => setState(() => _page++) : null, icon: Sym(MSym.chevronRight, size: 20, color: c.onSurfaceVariant)),
      ]),
    );
  }
}
