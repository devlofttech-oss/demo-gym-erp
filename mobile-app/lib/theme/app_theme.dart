import 'package:flutter/material.dart';

/// MD3 semantic color tokens, ported 1:1 from the React app's `index.css`
/// `@theme` block (light) and its `.dark` override block (dark).
/// Exposed as a ThemeExtension so a single `context.c` flips with the theme.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  final Color primary;
  final Color onPrimary;
  final Color primaryContainer;
  final Color onPrimaryContainer;
  final Color secondary;
  final Color secondaryContainer;
  final Color onSecondaryContainer;
  final Color background;
  final Color surface;
  final Color onSurface;
  final Color onSurfaceVariant;
  final Color surfaceContainerLowest; // cards
  final Color surfaceContainerLow;
  final Color surfaceContainer;
  final Color surfaceContainerHigh;
  final Color outline;
  final Color outlineVariant;
  final Color error;
  final Color onError;
  final Color errorContainer;
  final Color onErrorContainer;

  const AppColors({
    required this.primary,
    required this.onPrimary,
    required this.primaryContainer,
    required this.onPrimaryContainer,
    required this.secondary,
    required this.secondaryContainer,
    required this.onSecondaryContainer,
    required this.background,
    required this.surface,
    required this.onSurface,
    required this.onSurfaceVariant,
    required this.surfaceContainerLowest,
    required this.surfaceContainerLow,
    required this.surfaceContainer,
    required this.surfaceContainerHigh,
    required this.outline,
    required this.outlineVariant,
    required this.error,
    required this.onError,
    required this.errorContainer,
    required this.onErrorContainer,
  });

  static const light = AppColors(
    primary: Color(0xFF3B0764),
    onPrimary: Color(0xFFFFFFFF),
    primaryContainer: Color(0xFFF3E8FF),
    onPrimaryContainer: Color(0xFF2E1065),
    secondary: Color(0xFF725C00),
    secondaryContainer: Color(0xFFFEDD74),
    onSecondaryContainer: Color(0xFF776000),
    background: Color(0xFFF9F9FB),
    surface: Color(0xFFF9F9FB),
    onSurface: Color(0xFF1A1C1D),
    onSurfaceVariant: Color(0xFF48454F),
    surfaceContainerLowest: Color(0xFFFFFFFF),
    surfaceContainerLow: Color(0xFFF3F3F5),
    surfaceContainer: Color(0xFFEEEEF0),
    surfaceContainerHigh: Color(0xFFE8E8EA),
    outline: Color(0xFF797580),
    outlineVariant: Color(0xFFC9C4D0),
    error: Color(0xFFBA1A1A),
    onError: Color(0xFFFFFFFF),
    errorContainer: Color(0xFFFFDAD6),
    onErrorContainer: Color(0xFF93000A),
  );

  static const dark = AppColors(
    primary: Color(0xFFCBB6F4),
    onPrimary: Color(0xFF2E1065),
    primaryContainer: Color(0xFF4C1D95),
    onPrimaryContainer: Color(0xFFEDE9FE),
    secondary: Color(0xFFE3C45E),
    secondaryContainer: Color(0xFF854D0E),
    onSecondaryContainer: Color(0xFFFEF08A),
    background: Color(0xFF020617),
    surface: Color(0xFF020617),
    onSurface: Color(0xFFF8FAFC),
    onSurfaceVariant: Color(0xFFA9B6C8),
    surfaceContainerLowest: Color(0xFF0F172A),
    surfaceContainerLow: Color(0xFF1E293B),
    surfaceContainer: Color(0xFF334155),
    surfaceContainerHigh: Color(0xFF475569),
    outline: Color(0xFF94A3B8),
    outlineVariant: Color(0xFF334155),
    error: Color(0xFFFFB4AB),
    onError: Color(0xFF690005),
    errorContainer: Color(0xFF93000A),
    onErrorContainer: Color(0xFFFFDAD6),
  );

  @override
  AppColors copyWith() => this;

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) => this;
}

/// Fixed Tailwind palette (used for status chips / accents that don't flip
/// with the MD3 tokens). Hexes match Tailwind's default scale exactly.
class TW {
  TW._();
  static const emerald50 = Color(0xFFECFDF5);
  static const emerald100 = Color(0xFFD1FAE5);
  static const emerald400 = Color(0xFF34D399);
  static const emerald500 = Color(0xFF10B981);
  static const emerald600 = Color(0xFF059669);
  static const emerald700 = Color(0xFF047857);
  static const rose50 = Color(0xFFFFF1F2);
  static const rose100 = Color(0xFFFFE4E6);
  static const rose200 = Color(0xFFFECDD3);
  static const rose400 = Color(0xFFFB7185);
  static const rose500 = Color(0xFFF43F5E);
  static const rose600 = Color(0xFFE11D48);
  static const rose700 = Color(0xFFBE123C);
  static const amber50 = Color(0xFFFFFBEB);
  static const amber100 = Color(0xFFFEF3C7);
  static const amber200 = Color(0xFFFDE68A);
  static const amber300 = Color(0xFFFCD34D);
  static const amber400 = Color(0xFFFBBF24);
  static const amber500 = Color(0xFFF59E0B);
  static const amber600 = Color(0xFFD97706);
  static const amber700 = Color(0xFFB45309);
  static const amber800 = Color(0xFF92400E);
  static const blue50 = Color(0xFFEFF6FF);
  static const blue100 = Color(0xFFDBEAFE);
  static const blue200 = Color(0xFFBFDBFE);
  static const blue600 = Color(0xFF2563EB);
  static const blue700 = Color(0xFF1D4ED8);
  static const violet50 = Color(0xFFF5F3FF);
  static const violet100 = Color(0xFFEDE9FE);
  static const violet400 = Color(0xFFA78BFA);
  static const violet600 = Color(0xFF7C3AED);
  static const violet700 = Color(0xFF6D28D9);
  static const sky50 = Color(0xFFF0F9FF);
  static const sky600 = Color(0xFF0284C7);
  static const orange100 = Color(0xFFFFEDD5);
  static const orange500 = Color(0xFFF97316);
  static const orange600 = Color(0xFFEA580C);
  static const orange700 = Color(0xFFC2410C);
  static const green50 = Color(0xFFF0FDF4);
  static const green100 = Color(0xFFDCFCE7);
  static const green200 = Color(0xFFBBF7D0);
  static const green600 = Color(0xFF16A34A);
  static const green700 = Color(0xFF15803D);
  static const pink50 = Color(0xFFFDF2F8);
  static const pink500 = Color(0xFFEC4899);
  static const pink600 = Color(0xFFDB2777);
  static const purple100 = Color(0xFFF3E8FF);
  static const purple700 = Color(0xFF7E22CE);
  static const slate100 = Color(0xFFF1F5F9);
  static const slate200 = Color(0xFFE2E8F0);
  static const slate400 = Color(0xFF94A3B8);
  static const slate500 = Color(0xFF64748B);
  static const slate700 = Color(0xFF334155);
  static const slate800 = Color(0xFF1E293B);
  static const slate900 = Color(0xFF0F172A);
  static const slate950 = Color(0xFF020617);
  static const whatsapp = Color(0xFF25D366);
}

/// Type scale ported from `@theme` (all Plus Jakarta Sans).
class KText {
  KText._();
  static const _f = 'PlusJakartaSans';
  static const h1 = TextStyle(fontFamily: _f, fontSize: 32, height: 1.2, fontWeight: FontWeight.w700);
  static const h2 = TextStyle(fontFamily: _f, fontSize: 24, height: 1.3, fontWeight: FontWeight.w700);
  static const h3 = TextStyle(fontFamily: _f, fontSize: 20, height: 1.4, fontWeight: FontWeight.w600);
  static const statValue = TextStyle(fontFamily: _f, fontSize: 28, height: 1.0, fontWeight: FontWeight.w700);
  static const bodyLg = TextStyle(fontFamily: _f, fontSize: 16, height: 1.6, fontWeight: FontWeight.w400);
  static const bodyMd = TextStyle(fontFamily: _f, fontSize: 14, height: 1.5, fontWeight: FontWeight.w400);
  static const labelCaps = TextStyle(fontFamily: _f, fontSize: 12, height: 1.0, fontWeight: FontWeight.w600);
}

/// Spacing constants from `@theme` (--spacing-*).
class KSpace {
  KSpace._();
  static const cardPadding = 24.0;
  static const stackGap = 16.0;
  static const gutter = 24.0;
  static const containerMargin = 32.0;
  static const sectionGap = 40.0;
}

/// Card shadow — matches `shadow-[0_10px_30px_rgba(207,196,255,0.15)]`.
const kCardShadow = [
  BoxShadow(color: Color(0x26CFC4FF), blurRadius: 30, offset: Offset(0, 10)),
];

extension AppColorsX on BuildContext {
  AppColors get c => Theme.of(this).extension<AppColors>()!;
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
}

ThemeData _base(AppColors c, Brightness b) {
  return ThemeData(
    useMaterial3: true,
    brightness: b,
    fontFamily: 'PlusJakartaSans',
    scaffoldBackgroundColor: c.background,
    colorScheme: ColorScheme.fromSeed(
      seedColor: c.primary,
      brightness: b,
    ).copyWith(
      primary: c.primary,
      onPrimary: c.onPrimary,
      surface: c.surface,
      onSurface: c.onSurface,
      error: c.error,
    ),
    extensions: [c],
    splashFactory: InkRipple.splashFactory,
  );
}

ThemeData buildLightTheme() => _base(AppColors.light, Brightness.light);
ThemeData buildDarkTheme() => _base(AppColors.dark, Brightness.dark);
