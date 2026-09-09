import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/actions.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

class _Entry {
  final String name;
  final String type; // member | staff
  final String? role;
  final String action; // in | out
  final DateTime time;
  final int? duration;
  final bool balanceDue;
  final bool gracePeriod;
  final num? balanceFees;
  final String? nextPaymentDate;
  _Entry({
    required this.name,
    required this.type,
    this.role,
    required this.action,
    required this.time,
    this.duration,
    this.balanceDue = false,
    this.gracePeriod = false,
    this.balanceFees,
    this.nextPaymentDate,
  });
}

class CheckinScreen extends StatefulWidget {
  const CheckinScreen({super.key});
  @override
  State<CheckinScreen> createState() => _CheckinScreenState();
}

class _CheckinScreenState extends State<CheckinScreen> {
  // autoStart:false so the camera does NOT turn on when the screen builds (it's a
  // bottom-nav tab, built at launch). It only starts when the user taps "Scan".
  final _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    autoStart: false,
  );
  bool _scanning = false;
  List<Map<String, dynamic>> _members = [];
  List<Map<String, dynamic>> _staff = [];
  bool _loading = true;
  bool _checkingIn = false;
  Map<String, dynamic>? _selectedMember;
  final _manualSearchCtrl = TextEditingController();
  String _manualSearch = '';
  bool _showResults = false;
  final List<_Entry> _recent = [];

  String? _lastScanId;
  DateTime _lastScanTime = DateTime(1970);

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void dispose() {
    _controller.dispose();
    _manualSearchCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    final gymId = context.read<AuthProvider>().gymId;
    try {
      final res = await Future.wait([
        TenantDb.getCollection(gymId, 'members'),
        TenantDb.getCollection(gymId, 'staff'),
      ]);
      _members = res[0];
      _staff = res[1];
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _startScan() async {
    setState(() => _scanning = true);
    try {
      await _controller.start();
    } catch (_) {
      if (mounted) setState(() => _scanning = false);
    }
  }

  Future<void> _stopScan() async {
    try {
      await _controller.stop();
    } catch (_) {}
    if (mounted) setState(() => _scanning = false);
  }

  void _onDetect(BarcodeCapture capture) {
    for (final b in capture.barcodes) {
      final raw = b.rawValue;
      if (raw == null || raw.isEmpty) continue;
      final now = DateTime.now();
      if (_lastScanId == raw && now.difference(_lastScanTime).inMilliseconds < 3000) return;
      _lastScanId = raw;
      _lastScanTime = now;
      _processCheckin(raw);
      break;
    }
  }

  Future<void> _processCheckin(String scannedId) async {
    if (_checkingIn) return;
    final member = _members.where((m) => m['id'] == scannedId).firstOrNull;
    final staff = member == null
        ? _staff.where((s) => s['qrId'] == scannedId || s['id'] == scannedId).firstOrNull
        : null;
    if (member == null && staff == null) {
      Beep.error();
      _toast('Invalid QR Code. Not found.', TW.rose600);
      return;
    }
    setState(() => _checkingIn = true);
    try {
      if (member != null) {
        await _processMember(member);
      } else {
        await _processStaff(staff!);
      }
    } finally {
      if (mounted) setState(() => _checkingIn = false);
    }
  }

  Future<void> _processMember(Map<String, dynamic> member) async {
    final gymId = context.read<AuthProvider>().gymId!;
    if (!isMemberEligible(member)) {
      Beep.warning();
      _showExpiredDialog(member);
      return;
    }
    final today = todayStr();
    final todayRecords = await TenantDb.getCollection(gymId, 'attendance', conditions: [
      Cond('memberId', '==', member['id']),
      Cond('date', '==', today),
    ]);
    final active = todayRecords.where((r) => r['checkOutTime'] == null).firstOrNull;

    final hasBalance = asNum(member['balanceFees']) > 0;
    final nextPay = member['nextPaymentDate'] as String?;
    final inGrace = hasBalance && nextPay != null && today.compareTo(nextPay) <= 0;
    final warnBalance = hasBalance && !inGrace;

    if (active != null) {
      final checkOut = DateTime.now();
      final checkIn = toDate(active['checkInTime']) ?? checkOut;
      final duration = checkOut.difference(checkIn).inMinutes;
      await TenantDb.updateDocument(gymId, 'attendance', active['id'], {
        'checkOutTime': checkOut.toIso8601String(),
        'duration': duration,
      });
      Beep.checkout();
      _toast('${member['name']} checked out! ($duration min)', TW.blue600);
      _push(_Entry(name: member['name'] ?? '', type: 'member', action: 'out', time: checkOut, duration: duration));
    } else {
      final checkIn = DateTime.now();
      await TenantDb.createDocument(gymId, 'attendance', {
        'memberId': member['id'],
        'memberName': member['name'],
        'date': today,
        'checkInTime': checkIn.toIso8601String(),
        'checkOutTime': null,
        'duration': null,
        'status': member['status'],
        if (hasBalance) 'balanceFees': member['balanceFees'],
      });
      if (warnBalance) {
        Beep.warning();
        _toast('${member['name']} checked in — Balance due: ${rupees(asNum(member['balanceFees']))}', TW.amber700);
      } else if (inGrace) {
        Beep.checkin();
        _toast('${member['name']} checked in — Balance due by $nextPay', TW.blue700);
      } else {
        Beep.checkin();
        _toast('${member['name']} checked in!', TW.emerald600);
      }
      _push(_Entry(
        name: member['name'] ?? '', type: 'member', action: 'in', time: checkIn,
        balanceDue: warnBalance, gracePeriod: inGrace,
        balanceFees: asNum(member['balanceFees']), nextPaymentDate: nextPay,
      ));
    }
  }

  Future<void> _processStaff(Map<String, dynamic> staff) async {
    final gymId = context.read<AuthProvider>().gymId!;
    final today = todayStr();
    final todayRecords = await TenantDb.getCollection(gymId, 'staffAttendance', conditions: [
      Cond('staffId', '==', staff['id']),
      Cond('date', '==', today),
    ]);
    final active = todayRecords.where((r) => r['checkOutTime'] == null).firstOrNull;
    if (active != null) {
      final checkOut = DateTime.now();
      final checkIn = toDate(active['checkInTime']) ?? checkOut;
      final duration = checkOut.difference(checkIn).inMinutes;
      await TenantDb.updateDocument(gymId, 'staffAttendance', active['id'], {
        'checkOutTime': checkOut.toIso8601String(),
        'duration': duration,
      });
      Beep.checkout();
      _toast('${staff['name']} checked out! ($duration min)', TW.blue600);
      _push(_Entry(name: staff['name'] ?? '', type: 'staff', role: staff['role'] as String?, action: 'out', time: checkOut, duration: duration));
    } else {
      final checkIn = DateTime.now();
      await TenantDb.createDocument(gymId, 'staffAttendance', {
        'staffId': staff['id'],
        'staffName': staff['name'],
        'role': staff['role'],
        'date': today,
        'checkInTime': checkIn.toIso8601String(),
        'checkOutTime': null,
        'duration': null,
      });
      Beep.checkin();
      _toast('${staff['name']} (${staff['role']}) checked in!', TW.emerald600);
      _push(_Entry(name: staff['name'] ?? '', type: 'staff', role: staff['role'] as String?, action: 'in', time: checkIn));
    }
  }

  void _push(_Entry e) => setState(() {
        _recent.insert(0, e);
        if (_recent.length > 10) _recent.removeRange(10, _recent.length);
      });

  void _toast(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color, duration: const Duration(seconds: 3)));
  }

  void _showExpiredDialog(Map<String, dynamic> member) {
    final c = context.c;
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: c.surfaceContainerLowest,
        icon: const Sym(MSym.block, size: 40, color: TW.rose500),
        title: Text('Entry Denied', style: TextStyle(color: c.onSurface)),
        content: Text(
          member['status'] == 'Frozen'
              ? '${member['name']}\'s membership is frozen.'
              : '${member['name']}\'s membership expired on ${member['expiryDate']}. Please renew to allow entry.',
          textAlign: TextAlign.center,
          style: TextStyle(color: c.onSurfaceVariant),
        ),
        actions: [FilledButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
      ),
    );
  }

  List<Map<String, dynamic>> get _manualResults {
    final q = _manualSearch.toLowerCase().trim();
    if (q.isEmpty) return [];
    return _members.where((m) {
      final name = (m['name'] as String?)?.toLowerCase() ?? '';
      final phone = (m['phone'] as String?) ?? '';
      return name.contains(q) || phone.contains(q);
    }).take(6).toList();
  }

  void _selectManualMember(Map<String, dynamic> m) {
    setState(() {
      _selectedMember = m;
      _manualSearchCtrl.text = '${m['name']} · ${m['phone'] ?? ''}';
      _manualSearch = '';
      _showResults = false;
    });
  }

  void _clearManualSelection() {
    setState(() {
      _selectedMember = null;
      _manualSearchCtrl.clear();
      _manualSearch = '';
      _showResults = false;
    });
  }

  Future<void> _manualCheckin() async {
    if (_selectedMember == null) { _toast('Please select a member', TW.rose600); return; }
    await _processMember(_selectedMember!);
    _clearManualSelection();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ListView(
      padding: const EdgeInsets.all(KSpace.gutter),
      children: [
        Text('Gym Check-in Scanner', style: KText.h1.copyWith(color: c.onSurface)),
        const SizedBox(height: 6),
        Text('Scan a QR to check in or out. Works for members and staff.', style: KText.bodyLg.copyWith(color: c.onSurfaceVariant)),
        const SizedBox(height: 16),
        _scannerCard(),
        const SizedBox(height: 16),
        _activityCard(),
      ],
    );
  }

  Widget _scannerCard() {
    final c = context.c;
    return KCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Sym(MSym.qrCodeScanner, size: 22, color: c.primary),
          const SizedBox(width: 8),
          Text('QR Scanner', style: KText.h3.copyWith(color: c.onSurface)),
          const Spacer(),
          _scanning
              ? const Pill('Scanning Active', fg: TW.emerald700, bg: TW.emerald100, dot: true)
              : const Pill('Camera Off', fg: TW.slate500, bg: TW.slate100, dot: true),
        ]),
        const SizedBox(height: 16),
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: AspectRatio(
            aspectRatio: 1,
            child: _scanning
                ? Container(
                    color: Colors.black,
                    child: Stack(fit: StackFit.expand, children: [
                      MobileScanner(controller: _controller, onDetect: _onDetect),
                      Center(
                        child: Container(
                          width: 200, height: 200,
                          decoration: BoxDecoration(border: Border.all(color: Colors.white70, width: 2), borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ]),
                  )
                : Container(
                    color: c.surfaceContainer,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Sym(MSym.qrCodeScanner, size: 56, color: c.onSurfaceVariant.withValues(alpha: 0.5)),
                        const SizedBox(height: 8),
                        Text('Tap "Scan" to start the camera',
                            style: TextStyle(color: c.onSurfaceVariant, fontSize: 13)),
                      ],
                    ),
                  ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: _scanning
              ? OutlinedButton.icon(
                  onPressed: _stopScan,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: TW.rose600,
                    side: const BorderSide(color: TW.rose600),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  icon: const Sym(MSym.close, size: 18),
                  label: const Text('Stop scanning'),
                )
              : FilledButton.icon(
                  onPressed: _startScan,
                  style: FilledButton.styleFrom(
                    backgroundColor: c.primary,
                    foregroundColor: c.onPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  icon: const Sym(MSym.qrCodeScanner, size: 18),
                  label: const Text('Scan QR'),
                ),
        ),
        const SizedBox(height: 16),
        const Divider(height: 1),
        const SizedBox(height: 16),
        Text('Manual Fallback', style: TextStyle(color: c.onSurface, fontSize: 14, fontWeight: FontWeight.w500)),
        const SizedBox(height: 4),
        Text('Type member name or phone to search', style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(color: c.surfaceContainer, borderRadius: BorderRadius.circular(12), border: Border.all(color: _selectedMember != null ? c.primary.withValues(alpha: 0.4) : c.outlineVariant.withValues(alpha: 0.3))),
          child: Row(children: [
            const SizedBox(width: 12),
            Sym(_selectedMember != null ? MSym.checkCircle : MSym.search, size: 18,
                color: _selectedMember != null ? c.primary : c.onSurfaceVariant),
            const SizedBox(width: 8),
            Expanded(child: TextField(
              controller: _manualSearchCtrl,
              enabled: !_loading,
              onChanged: (v) => setState(() {
                _manualSearch = v;
                _showResults = v.isNotEmpty;
                if (_selectedMember != null && v != '${_selectedMember!['name']} · ${_selectedMember!['phone'] ?? ''}') {
                  _selectedMember = null;
                }
              }),
              onTap: () { if (_selectedMember != null) _clearManualSelection(); },
              style: TextStyle(color: c.onSurface, fontSize: 14),
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: _loading ? 'Loading members...' : 'Name or phone number...',
                hintStyle: TextStyle(color: c.onSurfaceVariant),
                contentPadding: const EdgeInsets.symmetric(vertical: 14),
              ),
            )),
            if (_manualSearchCtrl.text.isNotEmpty)
              GestureDetector(
                onTap: _clearManualSelection,
                child: Padding(padding: const EdgeInsets.all(10), child: Sym(MSym.close, size: 16, color: c.onSurfaceVariant)),
              ),
          ]),
        ),
        // Search results dropdown
        if (_showResults && _manualResults.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(
              color: c.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: c.outlineVariant.withValues(alpha: 0.3)),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 8, offset: const Offset(0, 4))],
            ),
            child: Column(
              children: _manualResults.map((m) {
                final isLast = m == _manualResults.last;
                return GestureDetector(
                  onTap: () => _selectManualMember(m),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      border: isLast ? null : Border(bottom: BorderSide(color: c.outlineVariant.withValues(alpha: 0.15))),
                    ),
                    child: Row(children: [
                      InitialAvatar(name: m['name'] as String?, size: 30, bg: c.primaryContainer, fg: c.primary),
                      const SizedBox(width: 10),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text((m['name'] as String?) ?? '—', style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w600, fontSize: 13)),
                        Text((m['phone'] as String?) ?? '', style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
                      ])),
                      Pill(m['status']?.toString() ?? '—',
                          fg: m['status'] == 'Active' ? TW.emerald700 : TW.rose600,
                          bg: m['status'] == 'Active' ? TW.emerald100 : TW.rose100),
                    ]),
                  ),
                );
              }).toList(),
            ),
          ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: c.primary, foregroundColor: c.onPrimary,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            onPressed: (_checkingIn || _loading || _selectedMember == null) ? null : _manualCheckin,
            icon: _checkingIn ? const KSpinner(size: 16, color: Colors.white) : const Sym(MSym.howToReg, size: 16),
            label: Text(_checkingIn ? 'Processing...' : 'Check In${_selectedMember != null ? ' · ${_selectedMember!['name']}' : ''}'),
          ),
        ),
      ]),
    );
  }

  Widget _activityCard() {
    final c = context.c;
    return KCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Sym(MSym.history, size: 22, color: TW.emerald600),
          const SizedBox(width: 8),
          Text('Live Activity', style: KText.h3.copyWith(color: c.onSurface)),
        ]),
        const SizedBox(height: 16),
        if (_recent.isEmpty)
          const KEmpty(icon: MSym.howToReg, message: 'Waiting for scans...')
        else
          ..._recent.map(_entryTile),
      ]),
    );
  }

  Widget _entryTile(_Entry e) {
    final c = context.c;
    final out = e.action == 'out';
    final warn = e.balanceDue;
    final grace = e.gracePeriod;
    Color bg, iconBg, iconFg;
    IconData icon;
    if (warn) { bg = TW.amber50; iconBg = TW.amber100; iconFg = TW.amber700; icon = MSym.warning; }
    else if (grace) { bg = TW.blue50; iconBg = TW.blue100; iconFg = TW.blue600; icon = MSym.schedule; }
    else if (out) { bg = TW.blue50; iconBg = TW.blue100; iconFg = TW.blue600; icon = MSym.logout; }
    else { bg = c.surfaceContainerLow; iconBg = TW.emerald100; iconFg = TW.emerald600; icon = MSym.login; }

    final sub = StringBuffer();
    if (e.type == 'staff' && e.role != null) sub.write('${e.role} · ');
    sub.write(out ? 'Check-out${e.duration != null ? ' · ${e.duration} min' : ''}' : 'Check-in');
    if (warn) sub.write(' · Balance: ${rupees(e.balanceFees)}');
    if (grace) sub.write(' · Pay by ${e.nextPaymentDate}');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12), border: Border.all(color: c.outlineVariant.withValues(alpha: 0.2))),
      child: Row(children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle), child: Sym(icon, size: 22, color: iconFg, fill: true)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(e.name, style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w700)),
          Text(sub.toString(), style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
        ])),
        Text(fmtTime(e.time.toIso8601String()), style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w700, fontSize: 13)),
      ]),
    );
  }
}
