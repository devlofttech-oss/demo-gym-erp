import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../theme/app_icons.dart';

/// Material Symbols icon (variable font) with optional FILL, matching the
/// web app's `fontVariationSettings: 'FILL' 1`.
class Sym extends StatelessWidget {
  final IconData icon;
  final double size;
  final Color? color;
  final bool fill;
  final double? weight;
  const Sym(this.icon, {super.key, this.size = 24, this.color, this.fill = false, this.weight});

  @override
  Widget build(BuildContext context) {
    return Icon(
      icon,
      size: size,
      color: color,
      fill: fill ? 1.0 : 0.0,
      weight: weight,
    );
  }
}

/// White/dark card — `surface-container-lowest`, rounded-2xl, soft violet shadow.
class KCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final double radius;
  const KCard({super.key, required this.child, this.padding, this.onTap, this.radius = 16});

  @override
  Widget build(BuildContext context) {
    final card = Container(
      decoration: BoxDecoration(
        color: context.c.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: context.isDark ? null : kCardShadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: padding ?? const EdgeInsets.all(KSpace.cardPadding),
        child: child,
      ),
    );
    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(radius),
        onTap: onTap,
        child: card,
      ),
    );
  }
}

/// Spinning `progress_activity` icon — the app's loading indicator.
class KSpinner extends StatefulWidget {
  final double size;
  final Color? color;
  const KSpinner({super.key, this.size = 28, this.color});
  @override
  State<KSpinner> createState() => _KSpinnerState();
}

class _KSpinnerState extends State<KSpinner> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl =
      AnimationController(vsync: this, duration: const Duration(seconds: 1))..repeat();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RotationTransition(
      turns: _ctrl,
      child: Sym(MSym.progressActivity, size: widget.size, color: widget.color ?? context.c.primary),
    );
  }
}

/// Centered loading row with the spinner + text.
class KLoading extends StatelessWidget {
  final String label;
  const KLoading({super.key, this.label = 'Loading...'});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const KSpinner(size: 24),
          const SizedBox(width: 10),
          Text(label, style: TextStyle(color: context.c.onSurfaceVariant)),
        ],
      ),
    );
  }
}

/// Empty-state block: faint icon + message (+ optional action).
class KEmpty extends StatelessWidget {
  final IconData icon;
  final String message;
  final Widget? action;
  final Color? iconColor;
  const KEmpty({super.key, required this.icon, required this.message, this.action, this.iconColor});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Opacity(opacity: 0.4, child: Sym(icon, size: 48, color: iconColor ?? context.c.onSurfaceVariant)),
          const SizedBox(height: 12),
          Text(message, style: TextStyle(color: context.c.onSurfaceVariant, fontWeight: FontWeight.w500)),
          if (action != null) ...[const SizedBox(height: 12), action!],
        ],
      ),
    );
  }
}

/// Small pill / badge used for statuses and tags.
class Pill extends StatelessWidget {
  final String text;
  final Color fg;
  final Color bg;
  final IconData? icon;
  final bool dot;
  const Pill(this.text, {super.key, required this.fg, required this.bg, this.icon, this.dot = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot)
            Container(
              width: 6, height: 6, margin: const EdgeInsets.only(right: 5),
              decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
            ),
          if (icon != null) ...[Sym(icon!, size: 12, color: fg), const SizedBox(width: 4)],
          Text(text, style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

/// Circular avatar with an initial (falls back to '?').
class InitialAvatar extends StatelessWidget {
  final String? name;
  final double size;
  final Color bg;
  final Color fg;
  const InitialAvatar({super.key, this.name, this.size = 40, required this.bg, required this.fg});
  @override
  Widget build(BuildContext context) {
    final ch = (name != null && name!.isNotEmpty) ? name![0].toUpperCase() : '?';
    return Container(
      width: size, height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
      child: Text(ch, style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: size * 0.4)),
    );
  }
}

/// Page section title (h1 + subtitle) used at the top of each module.
class PageHeader extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget? trailing;
  const PageHeader(this.title, this.subtitle, {super.key, this.trailing});
  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: KText.h1.copyWith(color: context.c.onSurface)),
              const SizedBox(height: 6),
              Text(subtitle, style: KText.bodyLg.copyWith(color: context.c.onSurfaceVariant)),
            ],
          ),
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}
