import 'package:audioplayers/audioplayers.dart';
import 'package:url_launcher/url_launcher.dart';

/// Opens WhatsApp with a prefilled message — mirrors utils/whatsapp.js
/// (`https://wa.me/91<10digits>?text=...`).
Future<void> openWhatsApp(String phone, String message) async {
  final number = phone.replaceAll(RegExp(r'\D'), '');
  final last10 = number.length > 10 ? number.substring(number.length - 10) : number;
  final uri = Uri.parse('https://wa.me/91$last10?text=${Uri.encodeComponent(message)}');
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// Check-in beeps — same four tones as the React app's Web Audio playBeep().
class Beep {
  Beep._();
  static final _player = AudioPlayer();

  static Future<void> _play(String file) async {
    try {
      await _player.stop();
      await _player.play(AssetSource('sounds/$file'));
    } catch (_) {/* ignore audio failures */}
  }

  static Future<void> checkin() => _play('checkin.wav');
  static Future<void> checkout() => _play('checkout.wav');
  static Future<void> warning() => _play('warning.wav');
  static Future<void> error() => _play('error.wav');
}
