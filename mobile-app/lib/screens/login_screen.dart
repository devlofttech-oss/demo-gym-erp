import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../theme/app_icons.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

/// Ported from Login.jsx — centered card, "Kilos" title, email/password with
/// a visibility toggle, and the DevLoft footer.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _showPassword = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      await context.read<AuthProvider>().login(_email.text.trim(), _password.text);
    } catch (e) {
      setState(() => _error = 'Invalid credentials. Please try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  InputDecoration _dec(String hint) {
    final c = context.c;
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: c.onSurfaceVariant.withValues(alpha: 0.7)),
      filled: true,
      fillColor: c.surfaceContainer,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: c.outlineVariant.withValues(alpha: 0.5)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: c.primary, width: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      backgroundColor: c.surface,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 448),
            child: Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: c.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: c.outlineVariant.withValues(alpha: 0.3)),
                boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 40, offset: Offset(0, 20))],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Image.asset(
                      'assets/images/kilos_logo.png',
                      width: 72,
                      height: 72,
                      filterQuality: FilterQuality.high,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text('Kilos',
                      textAlign: TextAlign.center,
                      style: KText.h1.copyWith(color: c.onSurface, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text('by Devloft Technologies',
                      textAlign: TextAlign.center,
                      style: KText.bodyMd.copyWith(color: c.primary, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 12),
                  Text('Sign in to your management dashboard',
                      textAlign: TextAlign.center,
                      style: KText.bodyMd.copyWith(color: c.onSurfaceVariant)),
                  const SizedBox(height: 28),
                  if (auth.inactiveGymError) _banner(
                    c.errorContainer.withValues(alpha: 0.4),
                    TW.amber800,
                    'Your gym account is currently inactive. Please contact support.',
                  ),
                  if (_error != null) _banner(c.errorContainer, c.onErrorContainer, _error!),
                  _label('Email address'),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autofocus: true,
                    style: TextStyle(color: c.onSurface),
                    decoration: _dec('admin@deepfitness.com'),
                  ),
                  const SizedBox(height: 20),
                  _label('Password'),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _password,
                    obscureText: !_showPassword,
                    style: TextStyle(color: c.onSurface),
                    onSubmitted: (_) => _submit(),
                    decoration: _dec('••••••••').copyWith(
                      suffixIcon: IconButton(
                        icon: Sym(_showPassword ? MSym.visibilityOff : MSym.visibility,
                            size: 20, color: c.onSurfaceVariant),
                        onPressed: () => setState(() => _showPassword = !_showPassword),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    height: 52,
                    child: FilledButton(
                      onPressed: _loading ? null : _submit,
                      style: FilledButton.styleFrom(
                        backgroundColor: c.primary,
                        foregroundColor: c.onPrimary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _loading
                          ? const KSpinner(size: 22, color: Colors.white)
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Sym(MSym.login, size: 20, color: c.onPrimary),
                                const SizedBox(width: 8),
                                const Text('Sign In', style: TextStyle(fontWeight: FontWeight.w700)),
                              ],
                            ),
                    ),
                  ),
                  const SizedBox(height: 28),
                  Opacity(
                    opacity: 0.7,
                    child: Text('Developed by DevLoft Tech',
                        textAlign: TextAlign.center,
                        style: KText.labelCaps.copyWith(color: c.onSurfaceVariant, fontWeight: FontWeight.w400)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _label(String t) => Text(t, style: KText.bodyMd.copyWith(color: context.c.onSurface, fontWeight: FontWeight.w600));

  Widget _banner(Color bg, Color fg, String msg) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 20),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
        child: Text(msg, textAlign: TextAlign.center, style: TextStyle(color: fg, fontWeight: FontWeight.w500, fontSize: 14)),
      );
}
