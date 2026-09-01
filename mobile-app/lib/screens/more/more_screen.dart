import 'package:flutter/material.dart';

import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../classes/classes_screen.dart';
import '../communication/communication_screen.dart';
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

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
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
      _Tile(MSym.sms, 'Communication', TW.purple700, const CommunicationScreen()),
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
      ],
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

