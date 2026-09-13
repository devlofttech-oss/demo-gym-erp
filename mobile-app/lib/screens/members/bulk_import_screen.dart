import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

// Bulk member import from spreadsheet data pasted as text.
//
// Mirrors the web importer (src/pages/members/BulkImportMembers.jsx): same
// column aliases, same date coercion, same Firestore field mapping — so a sheet
// that imports on web imports identically here. Text intake rather than a file
// picker keeps this pure Dart, which is what lets it ship as a Shorebird patch.

class _ColumnSpec {
  final String label;
  final IconData icon;
  final List<String> keys;
  final bool required;
  const _ColumnSpec(this.label, this.icon, this.keys, {this.required = false});
}

const _nameKeys = ['NAME', 'Name', 'Member Name', 'name'];
const _phoneKeys = [
  'MOBILE NUMBER',
  'Mobile Number',
  'Phone',
  'Mobile',
  'phone',
];
const _joinKeys = [
  'ADMISSION DATE',
  'Admission Date',
  'Join Date',
  'joinDate',
  'Active From',
  'Start Date',
];
const _dobKeys = ['Date of birth', 'DOB', 'dob', 'Birth Date'];
const _genderKeys = ['Gender', 'GENDER', 'gender'];
const _planKeys = ['MEMBERSHIP', 'Membership', 'Plan', 'Plan Name', 'planName'];
const _expiryKeys = [
  'DUE DATE',
  'Due Date',
  'Expiry Date',
  'Expiry',
  'expiryDate',
];
const _totalFeeKeys = ['Total fees', 'Total Fees', 'TOTAL FEES', 'totalFees'];
const _paidFeeKeys = ['Fees paid', 'Fees Paid', 'FEES PAID', 'paidFees'];
const _balFeeKeys = [
  'Balance fees',
  'Balance Fees',
  'BALANCE FEES',
  'balanceFees',
];
const _payModeKeys = [
  'Payment mode',
  'Payment Mode',
  'PAYMENT MODE',
  'paymentMode',
];
const _statusKeys = ['STATUS', 'Status', 'status'];
const _emailKeys = ['Email', 'EMAIL', 'email'];

const _specs = <_ColumnSpec>[
  _ColumnSpec('Name', MSym.person, _nameKeys, required: true),
  _ColumnSpec('Phone number', MSym.sms, _phoneKeys, required: true),
  _ColumnSpec('Date of joining', MSym.calendarToday, _joinKeys),
  _ColumnSpec('Date of birth', MSym.today, _dobKeys),
  _ColumnSpec('Gender', MSym.group, _genderKeys),
  _ColumnSpec('Membership / Plan', MSym.loyalty, _planKeys),
  _ColumnSpec('Due / Expiry date', MSym.calendarMonth, _expiryKeys),
  _ColumnSpec('Fees (total / paid / balance)', MSym.accountBalanceWallet, [
    ..._totalFeeKeys,
    ..._paidFeeKeys,
    ..._balFeeKeys,
  ]),
];

/// Collapses a header to a comparison key so "Mobile Number", "MOBILE_NUMBER"
/// and "mobilenumber" all resolve to the same column.
String _norm(String s) => s.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');

String _pick(Map<String, String> row, List<String> keys) {
  for (final k in keys) {
    final v = row[_norm(k)];
    if (v != null && v.trim().isNotEmpty) return v.trim();
  }
  return '';
}

/// Splits one delimited line, honouring double-quoted fields and "" escapes.
List<String> _splitLine(String line, String delim) {
  final out = <String>[];
  final buf = StringBuffer();
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    final ch = line[i];
    if (ch == '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] == '"') {
        buf.write('"');
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch == delim && !inQuotes) {
      out.add(buf.toString().trim());
      buf.clear();
    } else {
      buf.write(ch);
    }
  }
  out.add(buf.toString().trim());
  return out;
}

/// Excel and Sheets copy as tab-separated; a saved .csv is comma-separated.
String _detectDelimiter(String headerLine) {
  final tabs = '\t'.allMatches(headerLine).length;
  final commas = ','.allMatches(headerLine).length;
  return tabs >= commas && tabs > 0 ? '\t' : ',';
}

String _parseDate(String raw) {
  final s = raw.trim();
  if (s.isEmpty) return '';
  if (RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(s)) return s;

  // Excel stores dates as a day count from 1899-12-30. Bound the range so a
  // phone number or a fee amount is never mistaken for a date.
  final serial = num.tryParse(s);
  if (serial != null && serial > 20000 && serial < 60000) {
    final ms = ((serial - 25569) * 86400000).round();
    return DateTime.fromMillisecondsSinceEpoch(
      ms,
      isUtc: true,
    ).toIso8601String().split('T').first;
  }

  final dmy = RegExp(r'^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$').firstMatch(s);
  if (dmy != null) {
    return '${dmy.group(3)}-${dmy.group(2)!.padLeft(2, '0')}-${dmy.group(1)!.padLeft(2, '0')}';
  }

  // A bare digit run that fell through the Excel-serial range is not a date.
  // DateTime.tryParse happily turns a phone number into a year, so stop here.
  if (RegExp(r'^\d+$').hasMatch(s)) return s;

  final parsed = DateTime.tryParse(s);
  if (parsed != null) return parsed.toIso8601String().split('T').first;
  return s;
}

num _toNum(String s) {
  if (s.isEmpty) return 0;
  return num.tryParse(s.replaceAll(RegExp(r'[^0-9.\-]'), '')) ?? 0;
}

class BulkImportScreen extends StatefulWidget {
  const BulkImportScreen({super.key});
  @override
  State<BulkImportScreen> createState() => _BulkImportScreenState();
}

class _BulkImportScreenState extends State<BulkImportScreen> {
  final _textCtrl = TextEditingController();

  List<Map<String, String>> _rows = [];
  List<String> _headers = [];
  String? _error;
  bool _importing = false;
  int _done = 0;

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  void _parse() {
    FocusScope.of(context).unfocus();
    final raw = _textCtrl.text.trim();
    if (raw.isEmpty) {
      setState(() {
        _error = 'Paste your spreadsheet rows first.';
        _rows = [];
      });
      return;
    }

    final lines = raw
        .split(RegExp(r'\r\n|\r|\n'))
        .where((l) => l.trim().isNotEmpty)
        .toList();
    if (lines.length < 2) {
      setState(() {
        _error = 'Include the header row plus at least one member row.';
        _rows = [];
      });
      return;
    }

    final delim = _detectDelimiter(lines.first);
    final headers = _splitLine(lines.first, delim);

    final parsed = <Map<String, String>>[];
    for (final line in lines.skip(1)) {
      final cells = _splitLine(line, delim);
      final row = <String, String>{};
      for (var i = 0; i < headers.length; i++) {
        final key = _norm(headers[i]);
        if (key.isEmpty) continue;
        row[key] = i < cells.length ? cells[i] : '';
      }
      parsed.add(row);
    }

    final withName = parsed
        .where((r) => _pick(r, _nameKeys).isNotEmpty)
        .toList();
    if (withName.isEmpty) {
      setState(() {
        _error =
            'No Name column found. Make sure the first line is the header row.';
        _rows = [];
      });
      return;
    }

    setState(() {
      _error = null;
      _headers = headers;
      _rows = withName;
    });
  }

  bool _hasColumn(List<String> keys) =>
      _headers.any((h) => keys.any((k) => _norm(k) == _norm(h)));

  Future<void> _import() async {
    final gymId = context.read<AuthProvider>().gymId ?? '';
    if (gymId.isEmpty || _rows.isEmpty) return;

    setState(() {
      _importing = true;
      _done = 0;
    });

    // Continue the MEM### sequence rather than restarting it.
    var maxNum = 0;
    try {
      final existing = await TenantDb.getCollection(gymId, 'members');
      for (final m in existing) {
        final id = m['memberId'] as String?;
        if (id != null && id.startsWith('MEM')) {
          final n = int.tryParse(id.substring(3));
          if (n != null && n > maxNum) maxNum = n;
        }
      }
      if (maxNum == 0) maxNum = existing.length;
    } catch (_) {}

    var success = 0;
    var failed = 0;
    final now = DateTime.now();

    for (final row in _rows) {
      try {
        final name = _pick(row, _nameKeys);
        if (name.isEmpty) {
          failed++;
          continue;
        }

        final joinDate = _parseDate(_pick(row, _joinKeys));
        final expiryDate = _parseDate(_pick(row, _expiryKeys));
        final membership = _pick(row, _planKeys);
        final statusRaw = _pick(row, _statusKeys);
        final payMode = _pick(row, _payModeKeys);

        final expired =
            expiryDate.isNotEmpty &&
            (DateTime.tryParse(expiryDate)?.isBefore(now) ?? false);

        maxNum++;
        await TenantDb.createDocument(gymId, 'members', {
          'memberId': 'MEM${maxNum.toString().padLeft(3, '0')}',
          'name': name,
          'phone': _pick(row, _phoneKeys),
          'email': _pick(row, _emailKeys),
          'birthday': _parseDate(_pick(row, _dobKeys)),
          'gender': _pick(row, _genderKeys),
          'planName': membership.isEmpty ? '' : 'Gym - $membership',
          'joinDate': joinDate,
          'planActiveFrom': joinDate,
          'expiryDate': expiryDate,
          'totalFees': _toNum(_pick(row, _totalFeeKeys)),
          'paidFees': _toNum(_pick(row, _paidFeeKeys)),
          'balanceFees': _toNum(_pick(row, _balFeeKeys)),
          'paymentMode': payMode.isEmpty ? 'Cash' : payMode,
          'status': expired
              ? 'Expired'
              : (statusRaw.isEmpty ? 'Active' : statusRaw),
          'importedAt': now.toIso8601String(),
        });
        success++;
      } catch (_) {
        failed++;
      }
      if (mounted) setState(() => _done++);
    }

    if (!mounted) return;
    setState(() => _importing = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Imported $success member${success == 1 ? '' : 's'}${failed > 0 ? ' · $failed skipped' : ''}',
        ),
        backgroundColor: failed > 0 ? TW.amber600 : TW.emerald600,
      ),
    );
    Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(title: const Text('Bulk Import Members')),
      body: AbsorbPointer(
        absorbing: _importing,
        child: ListView(
          padding: const EdgeInsets.all(KSpace.gutter),
          children: [
            Text(
              'Import your member list from a spreadsheet.',
              style: KText.bodyMd.copyWith(color: c.onSurfaceVariant),
            ),
            const SizedBox(height: 16),
            if (_rows.isEmpty) ..._inputState(c) else ..._previewState(c),
          ],
        ),
      ),
    );
  }

  List<Widget> _inputState(AppColors c) => [
    KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Sym(MSym.uploadFile, size: 20, color: c.primary),
              const SizedBox(width: 8),
              Text(
                'Paste your rows',
                style: KText.bodyLg.copyWith(
                  color: c.onSurface,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Open the sheet in Excel or Google Sheets, select the header row and '
            'all member rows, copy, then paste below.',
            style: KText.bodyMd.copyWith(color: c.onSurfaceVariant),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _textCtrl,
            maxLines: 10,
            minLines: 6,
            style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
            decoration: InputDecoration(
              hintText:
                  'NAME  MOBILE NUMBER  DUE DATE\n'
                  'Ravi Kumar  9876543210  15/09/2026',
              hintStyle: TextStyle(
                fontFamily: 'monospace',
                fontSize: 12,
                color: c.onSurfaceVariant,
              ),
              border: const OutlineInputBorder(),
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              TextButton.icon(
                onPressed: () async {
                  final data = await Clipboard.getData(Clipboard.kTextPlain);
                  final text = data?.text ?? '';
                  if (text.trim().isEmpty) return;
                  _textCtrl.text = text;
                  _parse();
                },
                icon: const Sym(MSym.add, size: 18),
                label: const Text('Paste from clipboard'),
              ),
              const Spacer(),
              FilledButton(onPressed: _parse, child: const Text('Preview')),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Sym(MSym.warning, size: 16, color: TW.rose600),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _error!,
                    style: KText.bodyMd.copyWith(color: TW.rose600),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    ),
    const SizedBox(height: 12),
    KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Columns we look for',
            style: KText.bodyLg.copyWith(
              color: c.onSurface,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Header names are matched loosely — case and spacing do not matter.',
            style: KText.bodyMd.copyWith(color: c.onSurfaceVariant),
          ),
          const SizedBox(height: 12),
          ..._specs.map(
            (s) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Sym(s.icon, size: 18, color: c.onSurfaceVariant),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      s.label,
                      style: KText.bodyMd.copyWith(color: c.onSurface),
                    ),
                  ),
                  if (s.required)
                    Pill(
                      'Required',
                      bg: TW.rose600.withValues(alpha: 0.1),
                      fg: TW.rose600,
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  ];

  List<Widget> _previewState(AppColors c) {
    final sample = _rows.take(5).toList();
    return [
      KCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Sym(MSym.checkCircle, size: 20, color: TW.emerald600),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${_rows.length} member${_rows.length == 1 ? '' : 's'} ready',
                    style: KText.bodyLg.copyWith(
                      color: c.onSurface,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (!_importing)
                  TextButton(
                    onPressed: () => setState(() {
                      _rows = [];
                      _headers = [];
                    }),
                    child: const Text('Start over'),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            ..._specs.map((s) {
              final found = _hasColumn(s.keys);
              final colour = found
                  ? TW.emerald600
                  : (s.required ? TW.rose600 : c.onSurfaceVariant);
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Sym(
                      found ? MSym.checkCircle : MSym.close,
                      size: 16,
                      color: colour,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        s.label,
                        style: KText.bodyMd.copyWith(
                          color: found ? c.onSurface : c.onSurfaceVariant,
                        ),
                      ),
                    ),
                    if (!found && s.required)
                      Text(
                        'missing',
                        style: KText.bodyMd.copyWith(color: TW.rose600),
                      ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
      const SizedBox(height: 12),
      KCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Preview',
              style: KText.bodyLg.copyWith(
                color: c.onSurface,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 10),
            ...sample.map((r) {
              final expiry = _parseDate(_pick(r, _expiryKeys));
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    InitialAvatar(
                      name: _pick(r, _nameKeys),
                      size: 34,
                      bg: c.primary.withValues(alpha: 0.12),
                      fg: c.primary,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _pick(r, _nameKeys),
                            style: KText.bodyMd.copyWith(
                              color: c.onSurface,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            [
                              _pick(r, _phoneKeys),
                              if (expiry.isNotEmpty) 'expires $expiry',
                            ].where((e) => e.isNotEmpty).join(' · '),
                            style: KText.bodyMd.copyWith(
                              color: c.onSurfaceVariant,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
            if (_rows.length > sample.length)
              Text(
                '+ ${_rows.length - sample.length} more',
                style: KText.bodyMd.copyWith(color: c.onSurfaceVariant),
              ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      if (_importing) ...[
        LinearProgressIndicator(
          value: _rows.isEmpty ? null : _done / _rows.length,
        ),
        const SizedBox(height: 8),
        Center(
          child: Text(
            'Importing $_done of ${_rows.length}…',
            style: KText.bodyMd.copyWith(color: c.onSurfaceVariant),
          ),
        ),
      ] else
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _hasColumn(_nameKeys) ? _import : null,
            icon: const Sym(MSym.personAdd, size: 18),
            label: Text(
              'Import ${_rows.length} member${_rows.length == 1 ? '' : 's'}',
            ),
          ),
        ),
      const SizedBox(height: 24),
    ];
  }
}
