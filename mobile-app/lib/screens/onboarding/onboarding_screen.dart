import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

class OnboardingScreen extends StatefulWidget {
  final VoidCallback onComplete;
  const OnboardingScreen({super.key, required this.onComplete});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  int _step = 0;
  bool _saving = false;

  // Plan
  final _planName = TextEditingController();
  final _planPrice = TextEditingController();
  String _durUnit = 'months';
  final _durValue = TextEditingController(text: '1');
  Map<String, dynamic>? _savedPlan;

  // Member
  final _memName = TextEditingController();
  final _memPhone = TextEditingController();

  @override
  void dispose() {
    _planName.dispose();
    _planPrice.dispose();
    _durValue.dispose();
    _memName.dispose();
    _memPhone.dispose();
    super.dispose();
  }

  Future<void> _savePlan() async {
    final name = _planName.text.trim();
    final price = double.tryParse(_planPrice.text.trim());
    if (name.isEmpty) { _err('Plan name is required'); return; }
    if (price == null || price <= 0) { _err('Enter a valid price'); return; }

    final gymId = context.read<AuthProvider>().gymId;
    if (gymId == null) return;
    setState(() => _saving = true);
    try {
      final plan = await TenantDb.createDocument(gymId, 'plans', {
        'name': name,
        'price': price,
        'durationUnit': _durUnit,
        'durationValue': int.tryParse(_durValue.text.trim()) ?? 1,
        if (_durUnit == 'months')
          'durationMonths': int.tryParse(_durValue.text.trim()) ?? 1,
        'type': 'gym',
        'isActive': true,
      });
      _savedPlan = plan;
      if (mounted) setState(() { _step = 1; _saving = false; });
    } catch (e) {
      if (mounted) { _err('Failed to save plan'); setState(() => _saving = false); }
    }
  }

  Future<void> _saveMember() async {
    final name = _memName.text.trim();
    if (name.isEmpty) { _err('Member name is required'); return; }

    final gymId = context.read<AuthProvider>().gymId;
    if (gymId == null) { setState(() => _step = 2); return; }
    setState(() => _saving = true);
    try {
      await TenantDb.createDocument(gymId, 'members', {
        'name': name,
        'phone': _memPhone.text.trim(),
        'planId': _savedPlan?['id'] ?? '',
        'planName': _savedPlan?['name'] ?? '',
        'status': 'active',
        'startDate': DateTime.now().toIso8601String().substring(0, 10),
      });
      if (mounted) setState(() { _step = 2; _saving = false; });
    } catch (e) {
      if (mounted) { _err('Failed to save member'); setState(() => _saving = false); }
    }
  }

  void _err(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: TW.rose600));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        automaticallyImplyLeading: false,
        centerTitle: true,
        title: Text('Setup', style: KText.h3.copyWith(color: c.onSurface)),
      ),
      body: Column(
        children: [
          _StepBar(step: _step),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: [
                _buildAddPlan(),
                _buildAddMember(),
                _buildDone(),
              ][_step],
            ),
          ),
        ],
      ),
    );
  }

  // ── Step 1 ─────────────────────────────────────────────────────────────────

  Widget _buildAddPlan() {
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Add a Plan', style: KText.h2.copyWith(color: c.onSurface, fontSize: 20)),
            const SizedBox(height: 4),
            Text(
              'Create at least one membership plan so you can add members to it later.',
              style: TextStyle(color: c.onSurfaceVariant, fontSize: 13),
            ),
          ]),
        ),
        const SizedBox(height: 14),
        KCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Gym Plan Creation Instructions',
                style: KText.h3.copyWith(color: c.onSurface, fontSize: 14)),
            const SizedBox(height: 10),
            _inst('1. Set plan name and price', 'Example: "6 Month Premium" – 5000'),
            _inst('2. Choose duration in months or days', 'Example: 6 months or 180 days'),
            _inst('3. Plans will be assigned to gym members',
                'Example: Assign "6 Month Premium" to new members'),
          ]),
        ),
        const SizedBox(height: 16),
        _field(_planName, 'Plan Name *', Icons.badge_outlined),
        const SizedBox(height: 12),
        _field(_planPrice, 'Price *', Icons.currency_rupee,
            type: TextInputType.number),
        const SizedBox(height: 12),
        Row(children: [
          Icon(Icons.calendar_today_outlined, color: c.primary, size: 20),
          const SizedBox(width: 10),
          ChoiceChip(
            label: const Text('Months'),
            selected: _durUnit == 'months',
            onSelected: (_) => setState(() => _durUnit = 'months'),
          ),
          const SizedBox(width: 8),
          ChoiceChip(
            label: const Text('Days'),
            selected: _durUnit == 'days',
            onSelected: (_) => setState(() => _durUnit = 'days'),
          ),
        ]),
        const SizedBox(height: 12),
        _field(
          _durValue,
          'Duration (${_durUnit == 'months' ? 'months' : 'days'})',
          Icons.schedule,
          type: TextInputType.number,
        ),
        const SizedBox(height: 24),
        _saveBtn('Save & Continue', _saving, _savePlan),
      ],
    );
  }

  // ── Step 2 ─────────────────────────────────────────────────────────────────

  Widget _buildAddMember() {
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Add a Member', style: KText.h2.copyWith(color: c.onSurface, fontSize: 20)),
            const SizedBox(height: 4),
            Text(
              'Add your first gym member. You can skip this step and add members later.',
              style: TextStyle(color: c.onSurfaceVariant, fontSize: 13),
            ),
          ]),
        ),
        const SizedBox(height: 14),
        if (_savedPlan != null)
          Container(
            margin: const EdgeInsets.only(bottom: 14),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: KD.primaryTint,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(children: [
              const Icon(Icons.check_circle, color: KD.primary, size: 18),
              const SizedBox(width: 8),
              Text('Plan: ${_savedPlan!['name']}',
                  style: const TextStyle(color: KD.primary, fontWeight: FontWeight.w600)),
            ]),
          ),
        _field(_memName, 'Member Name *', Icons.person_outline),
        const SizedBox(height: 12),
        _field(_memPhone, 'Phone Number', Icons.phone_outlined,
            type: TextInputType.phone),
        const SizedBox(height: 24),
        _saveBtn('Add Member & Continue', _saving, _saveMember),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: OutlinedButton(
            onPressed: () => setState(() => _step = 2),
            child: const Text('Skip for Now'),
          ),
        ),
      ],
    );
  }

  // ── Step 3 ─────────────────────────────────────────────────────────────────

  Widget _buildDone() {
    final c = context.c;
    return Column(
      children: [
        const SizedBox(height: 48),
        Container(
          width: 88,
          height: 88,
          decoration: const BoxDecoration(color: KD.primaryTint, shape: BoxShape.circle),
          child: const Center(
            child: Text('🎉', style: TextStyle(fontSize: 40)),
          ),
        ),
        const SizedBox(height: 24),
        Text("You're all set!", style: KText.h1.copyWith(color: c.onSurface, fontSize: 26)),
        const SizedBox(height: 8),
        Text(
          'Your gym is ready to manage.\nLet\'s get started!',
          textAlign: TextAlign.center,
          style: TextStyle(color: c.onSurfaceVariant, fontSize: 15, height: 1.5),
        ),
        const SizedBox(height: 40),
        _saveBtn('Go to Dashboard', false, widget.onComplete),
      ],
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  Widget _field(
    TextEditingController ctrl,
    String label,
    IconData icon, {
    TextInputType? type,
  }) {
    final c = context.c;
    return TextField(
      controller: ctrl,
      keyboardType: type,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
        prefixIcon: Icon(icon, color: c.primary),
        isDense: true,
      ),
    );
  }

  Widget _inst(String title, String sub) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title,
            style: TextStyle(
                color: c.onSurface, fontWeight: FontWeight.w600, fontSize: 13)),
        Text(sub,
            style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
      ]),
    );
  }

  Widget _saveBtn(String label, bool loading, VoidCallback onTap) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: FilledButton(
        onPressed: loading ? null : onTap,
        child: loading
            ? const KSpinner(size: 20, color: Colors.white)
            : Text(label,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
      ),
    );
  }
}

// ── Step bar ──────────────────────────────────────────────────────────────────

class _StepBar extends StatelessWidget {
  final int step;
  const _StepBar({required this.step});

  static const _labels = ['Add Plan', 'Add Member', 'View Dashboard'];

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
      decoration: BoxDecoration(
        color: c.surfaceContainerLowest,
        border: Border(
            bottom: BorderSide(color: c.outlineVariant.withValues(alpha: 0.3))),
      ),
      child: Row(
        children: [
          for (int i = 0; i < _labels.length; i++) ...[
            Expanded(
              child: Column(children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: i <= step ? KD.primary : Colors.transparent,
                    border: Border.all(
                      color: i <= step ? KD.primary : c.outlineVariant,
                      width: 1.5,
                    ),
                  ),
                  child: Center(
                    child: i < step
                        ? const Icon(Icons.check, color: Colors.white, size: 14)
                        : Text(
                            '${i + 1}',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: i <= step ? Colors.white : c.onSurfaceVariant,
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _labels[i],
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: i == step ? FontWeight.w700 : FontWeight.w400,
                    color: i <= step ? KD.primary : c.onSurfaceVariant,
                  ),
                ),
              ]),
            ),
            if (i < _labels.length - 1)
              Expanded(
                child: Container(
                  height: 1.5,
                  margin: const EdgeInsets.only(bottom: 20),
                  color: i < step
                      ? KD.primary
                      : c.outlineVariant.withValues(alpha: 0.5),
                ),
              ),
          ],
        ],
      ),
    );
  }
}
