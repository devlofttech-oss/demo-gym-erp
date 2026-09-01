import 'dart:io';

import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/helpers.dart';
import '../../services/tenant_db.dart';
import '../../theme/app_icons.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

const _fitnessGoals = [
  'Weight Loss',
  'Muscle Gain',
  'General Fitness',
  'Stamina',
  'Flexibility',
  'Rehabilitation'
];

class EditMemberScreen extends StatefulWidget {
  final Map<String, dynamic> member;
  const EditMemberScreen({super.key, required this.member});
  @override
  State<EditMemberScreen> createState() => _EditMemberScreenState();
}

class _EditMemberScreenState extends State<EditMemberScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _dob = TextEditingController();
  final _emergency = TextEditingController();
  final _health = TextEditingController();

  String? _fitnessGoal;
  File? _photoFile;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final m = widget.member;
    _name.text = m['name'] as String? ?? '';
    _phone.text = m['phone'] as String? ?? '';
    _email.text = m['email'] as String? ?? '';
    _dob.text = m['dateOfBirth'] as String? ?? '';
    _emergency.text = m['emergencyContact'] as String? ?? '';
    _health.text = m['healthNotes'] as String? ?? '';
    _fitnessGoal = m['fitnessGoal'] as String?;
  }

  @override
  void dispose() {
    for (final c in [_name, _phone, _email, _dob, _emergency, _health]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final picked = await showModalBottomSheet<XFile?>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Take photo'),
              onTap: () async {
                final f = await picker.pickImage(
                    source: ImageSource.camera,
                    imageQuality: 70,
                    maxWidth: 600);
                if (ctx.mounted) Navigator.pop(ctx, f);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Choose from gallery'),
              onTap: () async {
                final f = await picker.pickImage(
                    source: ImageSource.gallery,
                    imageQuality: 70,
                    maxWidth: 600);
                if (ctx.mounted) Navigator.pop(ctx, f);
              },
            ),
            if (_photoFile != null || (widget.member['photoUrl'] as String? ?? '').isNotEmpty)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.red),
                title: const Text('Remove photo',
                    style: TextStyle(color: Colors.red)),
                onTap: () => Navigator.pop(ctx),
              ),
          ],
        ),
      ),
    );
    if (picked != null) {
      setState(() => _photoFile = File(picked.path));
    }
  }

  Future<String?> _uploadPhoto(String gymId, String memberId) async {
    if (_photoFile == null) return null;
    try {
      final ref = FirebaseStorage.instance
          .ref('gyms/$gymId/members/$memberId/photo.jpg');
      await ref.putFile(_photoFile!);
      return await ref.getDownloadURL();
    } catch (_) {
      return null;
    }
  }

  Future<void> _pickDob() async {
    final init = DateTime.tryParse(_dob.text) ??
        DateTime.now().subtract(const Duration(days: 365 * 25));
    final picked = await showDatePicker(
      context: context,
      initialDate: init,
      firstDate: DateTime(1940),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => _dob.text = picked.toIso8601String().split('T').first);
    }
  }

  Future<void> _save() async {
    if (_phone.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Phone number is required')));
      return;
    }
    final gymId = context.read<AuthProvider>().gymId ?? '';
    final memberId = widget.member['id'] as String? ?? '';
    setState(() => _saving = true);
    try {
      final data = <String, dynamic>{
        'name': _name.text.trim(),
        'phone': _phone.text.trim(),
        'email': _email.text.trim(),
        'emergencyContact': _emergency.text.trim(),
        'healthNotes': _health.text.trim(),
        if (_dob.text.isNotEmpty) 'dateOfBirth': _dob.text,
        if (_fitnessGoal != null) 'fitnessGoal': _fitnessGoal,
      };
      if (_photoFile != null) {
        final url = await _uploadPhoto(gymId, memberId);
        if (url != null) data['photoUrl'] = url;
      }
      await TenantDb.updateDocument(gymId, 'members', memberId, data);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Member updated'),
              backgroundColor: TW.emerald600),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed: $e')));
      }
    }
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final existingPhoto = widget.member['photoUrl'] as String?;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        backgroundColor: c.background,
        elevation: 0,
        leading: IconButton(
          icon: Sym(MSym.arrowBack, size: 20, color: c.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Edit Member', style: KText.h3.copyWith(color: c.onSurface)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilledButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Text('Save'),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Photo picker
          Center(
            child: GestureDetector(
              onTap: _pickPhoto,
              child: Stack(
                children: [
                  CircleAvatar(
                    radius: 44,
                    backgroundColor: c.primaryContainer,
                    backgroundImage: _photoFile != null
                        ? FileImage(_photoFile!) as ImageProvider
                        : (existingPhoto != null && existingPhoto.isNotEmpty
                            ? NetworkImage(existingPhoto)
                            : null),
                    child: (_photoFile == null &&
                            (existingPhoto == null || existingPhoto.isEmpty))
                        ? Sym(MSym.addAPhoto, size: 28, color: c.primary)
                        : null,
                  ),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                          color: c.primary,
                          shape: BoxShape.circle,
                          border: Border.all(color: c.surface, width: 2)),
                      child: const Sym(MSym.edit, size: 13, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          KCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _sectionHeader(MSym.person, 'Personal Details', c),
                const SizedBox(height: 16),
                _field('Full Name *', _name, c),
                _field('Phone *', _phone, c, type: TextInputType.phone),
                _field('Email', _email, c, type: TextInputType.emailAddress),
                _dateTapField('Date of Birth', _dob.text, _pickDob, c),
                _field('Emergency Contact', _emergency, c,
                    hint: 'Name & phone'),
                _dropdown(c),
                _field('Health Notes', _health, c,
                    hint: 'Conditions, injuries...', maxLines: 3),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionHeader(IconData icon, String label, AppColors c) {
    return Row(children: [
      Sym(icon, size: 16, color: c.onSurfaceVariant),
      const SizedBox(width: 8),
      Text(label.toUpperCase(),
          style: KText.labelCaps
              .copyWith(color: c.onSurfaceVariant, letterSpacing: 1)),
    ]);
  }

  Widget _field(String label, TextEditingController ctrl, AppColors c,
      {TextInputType? type, String? hint, int maxLines = 1}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label,
            style: TextStyle(
                color: c.onSurface,
                fontSize: 13,
                fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          keyboardType: type,
          maxLines: maxLines,
          decoration: _dec(hint, c),
        ),
      ]),
    );
  }

  Widget _dateTapField(
      String label, String value, VoidCallback onTap, AppColors c) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label,
            style: TextStyle(
                color: c.onSurface,
                fontSize: 13,
                fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        InkWell(
          onTap: onTap,
          child: Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            decoration: BoxDecoration(
              color: c.surfaceContainer,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                  color: c.outlineVariant.withValues(alpha: 0.3)),
            ),
            child: Row(children: [
              Text(
                value.isEmpty ? 'Select date' : fmtDate(value),
                style: TextStyle(
                    color: value.isEmpty
                        ? c.onSurfaceVariant.withValues(alpha: 0.6)
                        : c.onSurface),
              ),
              const Spacer(),
              Sym(MSym.calendarMonth, size: 18, color: c.onSurfaceVariant),
            ]),
          ),
        ),
      ]),
    );
  }

  Widget _dropdown(AppColors c) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Fitness Goal',
            style: TextStyle(
                color: c.onSurface,
                fontSize: 13,
                fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: c.surfaceContainer,
            borderRadius: BorderRadius.circular(8),
            border:
                Border.all(color: c.outlineVariant.withValues(alpha: 0.3)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String?>(
              value: _fitnessGoal,
              isExpanded: true,
              dropdownColor: c.surfaceContainerLowest,
              hint: Text('Select goal',
                  style: TextStyle(color: c.onSurfaceVariant)),
              style: TextStyle(
                  color: c.onSurface,
                  fontFamily: 'PlusJakartaSans',
                  fontSize: 14),
              items: [
                const DropdownMenuItem(value: null, child: Text('No goal')),
                ..._fitnessGoals.map((g) =>
                    DropdownMenuItem(value: g, child: Text(g))),
              ],
              onChanged: (v) => setState(() => _fitnessGoal = v),
            ),
          ),
        ),
      ]),
    );
  }

  InputDecoration _dec(String? hint, AppColors c) => InputDecoration(
        isDense: true,
        hintText: hint,
        hintStyle: TextStyle(
            color: c.onSurfaceVariant.withValues(alpha: 0.6)),
        filled: true,
        fillColor: c.surfaceContainer,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(
                color: c.outlineVariant.withValues(alpha: 0.3))),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: c.primary, width: 2)),
      );
}
