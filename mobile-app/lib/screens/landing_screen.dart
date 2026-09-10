import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme/app_theme.dart';
import 'login_screen.dart';

const _registerUrl = 'https://app-kilos.devlofttech.com/register';
const _contactWaUrl = 'https://wa.me/917012583444';

class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  Future<void> _openUrl(BuildContext context, String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open link')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF2C1F8C), Color(0xFF1E1B2E)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              const Spacer(flex: 2),

              // Logo
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(24),
                ),
                padding: const EdgeInsets.all(14),
                child: Image.asset('assets/images/kilos_logo.png', fit: BoxFit.contain),
              ),
              const SizedBox(height: 28),

              // Headline
              const Text(
                'Simplify Gym\nManagement',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 34,
                  fontWeight: FontWeight.w800,
                  height: 1.15,
                  fontFamily: 'SpaceGrotesk',
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'All-in-one ERP for modern gyms',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.60),
                  fontSize: 15,
                  fontWeight: FontWeight.w400,
                ),
              ),

              const Spacer(flex: 3),

              // CTA buttons
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 28),
                child: Column(
                  children: [
                    SizedBox(
                      width: double.infinity,
                      height: 54,
                      child: ElevatedButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const LoginScreen()),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: KD.primaryDeep,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(27)),
                          elevation: 0,
                        ),
                        child: const Text(
                          'Login',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      height: 54,
                      child: OutlinedButton(
                        onPressed: () => _openUrl(context, _registerUrl),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: BorderSide(
                              color: Colors.white.withValues(alpha: 0.45)),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(27)),
                        ),
                        child: const Text(
                          'Register New Account',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              // Need help
              GestureDetector(
                onTap: () => _openUrl(context, _contactWaUrl),
                child: RichText(
                  text: TextSpan(
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.50),
                        fontSize: 13.5),
                    children: const [
                      TextSpan(text: 'Need help? '),
                      TextSpan(
                        text: 'Contact us',
                        style: TextStyle(
                          decoration: TextDecoration.underline,
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Powered by Kilos  ·  v1.0.5',
                style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.30), fontSize: 11.5),
              ),
              const SizedBox(height: 36),
            ],
          ),
        ),
      ),
    );
  }
}
