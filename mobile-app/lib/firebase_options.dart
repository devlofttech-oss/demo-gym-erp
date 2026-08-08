// Firebase config — same project as the Kilos web app (`gym-erp-demo`), so the
// mobile app and website share one backend and one dataset. Values taken from
// the web app's .env. Auth (email/password) + Firestore key off the API key and
// project id, so the web app id works across Android/iOS for this project.
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        return android;
    }
  }

  static const _apiKey = 'AIzaSyBDiLdNxmDPkMWu1ZbrgHX5rBnYoB1-kQM';
  static const _appId = '1:1042216377771:web:d4489d45b7e4d6097e46ee';
  static const _sender = '1042216377771';
  static const _project = 'gym-erp-demo';
  static const _bucket = 'gym-erp-demo.firebasestorage.app';
  static const _authDomain = 'gym-erp-demo.firebaseapp.com';

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: _apiKey,
    appId: _appId,
    messagingSenderId: _sender,
    projectId: _project,
    authDomain: _authDomain,
    storageBucket: _bucket,
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: _apiKey,
    appId: _appId,
    messagingSenderId: _sender,
    projectId: _project,
    storageBucket: _bucket,
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: _apiKey,
    appId: _appId,
    messagingSenderId: _sender,
    projectId: _project,
    storageBucket: _bucket,
    iosBundleId: 'com.devloft.kilos',
  );
}
