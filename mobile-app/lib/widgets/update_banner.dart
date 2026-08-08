import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shorebird_code_push/shorebird_code_push.dart';

import '../theme/app_icons.dart';
import '../theme/app_theme.dart';
import 'common.dart';

/// Shows a visible bar when a Shorebird OTA update is downloading or ready,
/// so the update isn't silent. Renders nothing when the app is up to date
/// (or on platforms without Shorebird, e.g. web).
class UpdateBanner extends StatefulWidget {
  const UpdateBanner({super.key});
  @override
  State<UpdateBanner> createState() => _UpdateBannerState();
}

enum _S { hidden, downloading, ready }

class _UpdateBannerState extends State<UpdateBanner> {
  final _updater = ShorebirdUpdater();
  _S _state = _S.hidden;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    try {
      final status = await _updater.checkForUpdate();
      if (!mounted) return;
      if (status == UpdateStatus.restartRequired) {
        setState(() => _state = _S.ready);
      } else if (status == UpdateStatus.outdated) {
        setState(() => _state = _S.downloading);
        await _updater.update();
        if (mounted) setState(() => _state = _S.ready);
      }
    } catch (_) {
      // No Shorebird updater available (web/desktop/debug) — stay hidden.
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_state == _S.hidden) return const SizedBox.shrink();

    final downloading = _state == _S.downloading;
    return Material(
      color: downloading ? TW.blue50 : TW.emerald50,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            if (downloading)
              const KSpinner(size: 18, color: TW.blue600)
            else
              const Sym(MSym.checkCircle, size: 18, color: TW.emerald600, fill: true),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                downloading ? 'Downloading update…' : 'Update ready to install',
                style: TextStyle(
                  color: downloading ? TW.blue700 : TW.emerald700,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
            if (!downloading)
              TextButton(
                onPressed: () => SystemNavigator.pop(),
                style: TextButton.styleFrom(foregroundColor: TW.emerald700),
                child: const Text('Restart'),
              ),
          ],
        ),
      ),
    );
  }
}
