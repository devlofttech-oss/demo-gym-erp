import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../providers/auth_provider.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../classes/classes_screen.dart';
import '../diet/diet_screen.dart';
import '../equipment/equipment_screen.dart';
import '../expenses/expenses_screen.dart';
import '../leads/leads_screen.dart';
import '../measurements/measurements_screen.dart';
import '../plans/plans_screen.dart';
import '../pt/pt_screen.dart';
import '../renewals/renewals_screen.dart';
import '../reports/report_screen.dart';
import '../settings/settings_screen.dart';
import '../staff/staff_screen.dart';
import '../supplements/supplements_screen.dart';
import '../workouts/workouts_screen.dart';

const _webAppUrl = 'https://app.kilos.devlofttech.com';
const _waCreditsUrl = '$_webAppUrl/whatsapp-credits';
const _iosAppUrl = 'https://apps.apple.com/in/app/kilos-gym-management/id6739598737';
const _youtubeUrl = 'https://www.youtube.com/@DevloftTechnologies';
const _contactWa = 'https://wa.me/917012583444';
const _contactEmail = 'mailto:support@kilos.devlofttech.com';

class MoreScreen extends StatefulWidget {
  const MoreScreen({super.key});
  @override
  State<MoreScreen> createState() => _MoreScreenState();
}

class _MoreScreenState extends State<MoreScreen> {
  Future<void> _launch(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open link')));
      }
    }
  }

  void _showHowToUse() {
    showModalBottomSheet(
      context: context,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _HowToSheet(onLaunch: _launch),
    );
  }

  void _showContactUs() {
    showModalBottomSheet(
      context: context,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ContactSheet(onLaunch: _launch),
    );
  }

  void _showRequestFeature() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FeatureRequestSheet(
        gymId: context.read<AuthProvider>().gymId ?? '',
        gymName: context.read<AuthProvider>().gymName,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final tiles = <_Tile>[
      _Tile(MSym.loyalty, 'Plans', TW.violet600, const PlansScreen()),
      _Tile(MSym.badge, 'Staff', TW.blue600, const StaffScreen()),
      _Tile(MSym.receiptLong, 'Expenses', TW.rose600, const ExpensesScreen()),
      _Tile(MSym.medication, 'Supplements', TW.emerald600, const SupplementsScreen()),
      _Tile(MSym.personSearch, 'Leads', TW.amber600, const LeadsScreen()),
      _Tile(MSym.autorenew, 'Renewals', TW.sky600, const RenewalsScreen()),
      _Tile(MSym.groups, 'Classes', TW.pink600, const ClassesScreen()),
      _Tile(MSym.fitnessCenter, 'Personal Training', TW.orange600, const PTScreen()),
      _Tile(MSym.monitorWeight, 'Measurements', TW.green600, const MeasurementsScreen()),
      _Tile(MSym.restaurant, 'Diet', TW.emerald700, const DietScreen()),
      _Tile(MSym.exercise, 'Workouts', TW.violet700, const WorkoutsScreen()),
      _Tile(MSym.build, 'Equipment', TW.slate500, const EquipmentScreen()),
      _Tile(MSym.insertChart, 'Reports', TW.blue700, const ReportScreen()),
      _Tile(MSym.settings, 'Settings', TW.slate700, const SettingsScreen()),
    ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
      children: [
        const PageHeader('More', 'All modules'),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 0.9,
          ),
          itemCount: tiles.length,
          itemBuilder: (_, i) => _TileCard(tile: tiles[i]),
        ),
        const SizedBox(height: 24),
        Text('QUICK LINKS', style: KText.labelCaps.copyWith(color: c.onSurfaceVariant, letterSpacing: 1.2)),
        const SizedBox(height: 10),
        KCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              _LinkTile(MSym.language, 'Access Web App', 'Manage your gym on desktop', TW.blue600, () => _launch(_webAppUrl)),
              _divider(c),
              _LinkTile(MSym.creditCard, 'Purchase WhatsApp Credits', 'Buy credits via web', TW.emerald600, () => _launch(_waCreditsUrl)),
              _divider(c),
              _LinkTile(MSym.phoneIphone, 'Download iOS App', 'Get Kilos on iPhone', TW.slate700, () => _launch(_iosAppUrl)),
              _divider(c),
              _LinkTile(MSym.helpOutline, 'How to Use Kilos?', 'Video tutorials', TW.violet600, _showHowToUse),
              _divider(c),
              _LinkTile(MSym.feedbackOutlined, 'Request a Feature', 'Tell us what you need', TW.amber600, _showRequestFeature),
              _divider(c),
              _LinkTile(MSym.contactPhone, 'Contact Us', 'WhatsApp or Email', TW.rose600, _showContactUs),
            ],
          ),
        ),
      ],
    );
  }

  Widget _divider(AppColors c) => Divider(height: 1, indent: 56, color: c.outlineVariant.withValues(alpha: 0.3));
}

Widget _LinkTile(IconData icon, String title, String subtitle, Color color, VoidCallback onTap) {
  return Builder(builder: (context) {
    final c = context.c;
    return ListTile(
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
        child: Sym(icon, color: color, size: 18),
      ),
      title: Text(title, style: TextStyle(color: c.onSurface, fontWeight: FontWeight.w600, fontSize: 14)),
      subtitle: Text(subtitle, style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
      trailing: Sym(MSym.chevronRight, size: 18, color: c.onSurfaceVariant),
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    );
  });
}

class _HowToSheet extends StatelessWidget {
  final Future<void> Function(String) onLaunch;
  const _HowToSheet({required this.onLaunch});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      decoration: BoxDecoration(color: c.surfaceContainerLowest, borderRadius: const BorderRadius.vertical(top: Radius.circular(20))),
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 36, height: 4, decoration: BoxDecoration(color: c.outlineVariant, borderRadius: BorderRadius.circular(2))),
        const SizedBox(height: 20),
        const Sym(MSym.helpOutline, size: 36, color: TW.violet600),
        const SizedBox(height: 12),
        Text('How to Use Kilos?', style: KText.h2.copyWith(color: c.onSurface)),
        const SizedBox(height: 6),
        Text('Select your preferred language', style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
        const SizedBox(height: 20),
        Row(children: [
          Expanded(child: FilledButton.icon(
            onPressed: () { Navigator.pop(context); onLaunch(_youtubeUrl); },
            icon: const Sym(MSym.playCircle, size: 18),
            label: const Text('English'),
            style: FilledButton.styleFrom(backgroundColor: TW.violet600, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14)),
          )),
          const SizedBox(width: 12),
          Expanded(child: OutlinedButton.icon(
            onPressed: () { Navigator.pop(context); onLaunch(_youtubeUrl); },
            icon: const Sym(MSym.playCircle, size: 18),
            label: const Text('हिंदी'),
            style: OutlinedButton.styleFrom(foregroundColor: c.onSurface, padding: const EdgeInsets.symmetric(vertical: 14)),
          )),
        ]),
        const SizedBox(height: 16),
      ]),
    );
  }
}

class _ContactSheet extends StatelessWidget {
  final Future<void> Function(String) onLaunch;
  const _ContactSheet({required this.onLaunch});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      decoration: BoxDecoration(color: c.surfaceContainerLowest, borderRadius: const BorderRadius.vertical(top: Radius.circular(20))),
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 36, height: 4, decoration: BoxDecoration(color: c.outlineVariant, borderRadius: BorderRadius.circular(2))),
        const SizedBox(height: 20),
        const Sym(MSym.contactPhone, size: 36, color: TW.emerald600),
        const SizedBox(height: 12),
        Text('Contact Us', style: KText.h2.copyWith(color: c.onSurface)),
        const SizedBox(height: 6),
        Text("We're here to help you", style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
        const SizedBox(height: 20),
        Row(children: [
          Expanded(child: FilledButton.icon(
            onPressed: () { Navigator.pop(context); onLaunch(_contactWa); },
            icon: const Sym(MSym.chat, size: 18),
            label: const Text('WhatsApp'),
            style: FilledButton.styleFrom(backgroundColor: TW.emerald600, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14)),
          )),
          const SizedBox(width: 12),
          Expanded(child: OutlinedButton.icon(
            onPressed: () { Navigator.pop(context); onLaunch(_contactEmail); },
            icon: const Sym(MSym.email, size: 18),
            label: const Text('Mail Us'),
            style: OutlinedButton.styleFrom(foregroundColor: c.onSurface, padding: const EdgeInsets.symmetric(vertical: 14)),
          )),
        ]),
        const SizedBox(height: 16),
      ]),
    );
  }
}

class _FeatureRequestSheet extends StatefulWidget {
  final String gymId;
  final String gymName;
  const _FeatureRequestSheet({required this.gymId, required this.gymName});

  @override
  State<_FeatureRequestSheet> createState() => _FeatureRequestSheetState();
}

class _FeatureRequestSheetState extends State<_FeatureRequestSheet> {
  final _ctrl = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await TenantDb.createDocument(widget.gymId, 'featureRequests', {
        'gymId': widget.gymId,
        'gymName': widget.gymName,
        'request': text,
        'submittedAt': DateTime.now().toIso8601String(),
        'status': 'pending',
      });
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Feature request sent! Thank you.'), backgroundColor: TW.emerald600),
        );
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to send. Try again.')));
    }
    if (mounted) setState(() => _sending = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(color: c.surfaceContainerLowest, borderRadius: const BorderRadius.vertical(top: Radius.circular(20))),
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(child: Container(width: 36, height: 4, decoration: BoxDecoration(color: c.outlineVariant, borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 20),
          Text('Request a Feature', style: KText.h2.copyWith(color: c.onSurface)),
          const SizedBox(height: 6),
          Text('Tell us what feature you would like to see in Kilos.', style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
          const SizedBox(height: 16),
          TextField(
            controller: _ctrl,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: 'Describe the feature you need...',
              hintStyle: TextStyle(color: c.onSurfaceVariant.withValues(alpha: 0.6)),
              filled: true,
              fillColor: c.surfaceContainer,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: c.primary, width: 2)),
              contentPadding: const EdgeInsets.all(14),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: FilledButton(
              onPressed: _sending ? null : _send,
              child: _sending ? const KSpinner(size: 18, color: Colors.white) : const Text('Request'),
            ),
          ),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }
}

class _Tile {
  final IconData icon;
  final String label;
  final Color color;
  final Widget screen;
  const _Tile(this.icon, this.label, this.color, this.screen);
}

class _TileCard extends StatelessWidget {
  final _Tile tile;
  const _TileCard({required this.tile});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Material(
      color: tile.color.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => tile.screen)),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: tile.color.withValues(alpha: 0.18)),
          ),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: tile.color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Sym(tile.icon, color: tile.color, size: 22),
              ),
              const SizedBox(height: 8),
              Text(
                tile.label,
                style: TextStyle(
                  fontFamily: 'PlusJakartaSans',
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: c.onSurface,
                  height: 1.2,
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
