import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/helpers.dart';
import '../theme/app_icons.dart';
import '../theme/app_theme.dart';
import 'common.dart';

/// Bell icon widget that shows an unread badge count and opens the
/// notification panel bottom sheet on tap.
class NotificationBell extends StatelessWidget {
  const NotificationBell({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final gymId = context.watch<AuthProvider>().gymId;

    if (gymId == null || gymId.isEmpty) {
      return IconButton(
        icon: Sym(MSym.notifications, size: 22, color: c.onSurfaceVariant),
        onPressed: null,
      );
    }

    final stream = FirebaseFirestore.instance
        .collection('gyms')
        .doc(gymId)
        .collection('notifications')
        .where('isRead', isEqualTo: false)
        .snapshots();

    return StreamBuilder<QuerySnapshot>(
      stream: stream,
      builder: (_, snap) {
        final count = snap.data?.docs.length ?? 0;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            IconButton(
              icon: Sym(
                MSym.notifications,
                size: 22,
                color: count > 0 ? c.primary : c.onSurfaceVariant,
                fill: count > 0,
              ),
              onPressed: () => _showPanel(context, gymId),
            ),
            if (count > 0)
              Positioned(
                right: 6,
                top: 6,
                child: Container(
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    color: TW.rose600,
                    shape: BoxShape.circle,
                    border:
                        Border.all(color: c.surfaceContainerLowest, width: 1.5),
                  ),
                  child: Center(
                    child: Text(
                      count > 9 ? '9+' : '$count',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  void _showPanel(BuildContext context, String gymId) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _NotificationPanel(gymId: gymId),
    );
  }
}

class _NotificationPanel extends StatefulWidget {
  final String gymId;
  const _NotificationPanel({required this.gymId});

  @override
  State<_NotificationPanel> createState() => _NotificationPanelState();
}

class _NotificationPanelState extends State<_NotificationPanel> {
  List<Map<String, dynamic>> _notifications = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    if (mounted) setState(() => _loading = true);
    try {
      final snap = await FirebaseFirestore.instance
          .collection('gyms')
          .doc(widget.gymId)
          .collection('notifications')
          .orderBy('createdAt', descending: true)
          .limit(50)
          .get();
      if (mounted) {
        setState(() {
          _notifications = snap.docs
              .map((d) => {'id': d.id, ...d.data()})
              .toList();
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _markAllRead() async {
    final unread =
        _notifications.where((n) => n['isRead'] != true).toList();
    for (final n in unread) {
      await FirebaseFirestore.instance
          .collection('gyms')
          .doc(widget.gymId)
          .collection('notifications')
          .doc(n['id'] as String)
          .update({'isRead': true});
    }
    _fetch();
  }

  Future<void> _markRead(String id) async {
    await FirebaseFirestore.instance
        .collection('gyms')
        .doc(widget.gymId)
        .collection('notifications')
        .doc(id)
        .update({'isRead': true});
    _fetch();
  }

  Future<void> _clearAll() async {
    for (final n in _notifications) {
      await FirebaseFirestore.instance
          .collection('gyms')
          .doc(widget.gymId)
          .collection('notifications')
          .doc(n['id'] as String)
          .delete();
    }
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final unread = _notifications.where((n) => n['isRead'] != true).length;

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 8),
          Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                  color: TW.slate200, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Text('Notifications',
                    style: KText.h3.copyWith(color: c.onSurface)),
                if (unread > 0) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                        color: TW.rose600, borderRadius: BorderRadius.circular(10)),
                    child: Text('$unread',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700)),
                  ),
                ],
                const Spacer(),
                if (_notifications.isNotEmpty) ...[
                  if (unread > 0)
                    TextButton(
                        onPressed: _markAllRead,
                        child: const Text('Mark all read')),
                  TextButton(
                    onPressed: () async {
                      final ok = await showDialog<bool>(
                        context: context,
                        builder: (_) => AlertDialog(
                          title: const Text('Clear All'),
                          content: const Text(
                              'Delete all notifications? This cannot be undone.'),
                          actions: [
                            TextButton(
                                onPressed: () => Navigator.pop(context, false),
                                child: const Text('Cancel')),
                            FilledButton(
                              style: FilledButton.styleFrom(
                                  backgroundColor: TW.rose600),
                              onPressed: () => Navigator.pop(context, true),
                              child: const Text('Clear'),
                            ),
                          ],
                        ),
                      );
                      if (ok == true) _clearAll();
                    },
                    child:
                        Text('Clear all', style: TextStyle(color: TW.rose600)),
                  ),
                ],
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: _loading
                ? const KLoading()
                : _notifications.isEmpty
                    ? KEmpty(
                        icon: MSym.notifications,
                        message: 'No notifications',
                      )
                    : ListView.separated(
                        padding: EdgeInsets.zero,
                        itemCount: _notifications.length,
                        separatorBuilder: (_, __) =>
                            Divider(height: 1, color: c.outlineVariant.withValues(alpha: 0.3)),
                        itemBuilder: (_, i) {
                          final n = _notifications[i];
                          final isRead = n['isRead'] == true;
                          final nType = n['type'] as String? ?? '';
                          return ListTile(
                            leading: Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: _typeColor(nType).withValues(alpha: 0.1),
                                shape: BoxShape.circle,
                              ),
                              child: Sym(_typeIcon(nType),
                                  size: 18, color: _typeColor(nType)),
                            ),
                            title: Text(n['title'] ?? n['message'] ?? '',
                                style: KText.bodyMd.copyWith(
                                    color: c.onSurface,
                                    fontWeight: isRead
                                        ? FontWeight.normal
                                        : FontWeight.w600)),
                            subtitle: n['message'] != null &&
                                    n['message'] != n['title']
                                ? Text(n['message'],
                                    style: KText.bodyMd.copyWith(
                                        color: c.onSurfaceVariant, fontSize: 12),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis)
                                : Text(fmtDate(n['createdAt']),
                                    style: KText.bodyMd.copyWith(
                                        color: c.onSurfaceVariant, fontSize: 11)),
                            tileColor: isRead
                                ? null
                                : c.primary.withValues(alpha: 0.04),
                            onTap: isRead ? null : () => _markRead(n['id']),
                            trailing: isRead
                                ? null
                                : Container(
                                    width: 8,
                                    height: 8,
                                    decoration: BoxDecoration(
                                        color: c.primary,
                                        shape: BoxShape.circle),
                                  ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Color _typeColor(String type) {
    switch (type) {
      case 'expiry':
        return TW.amber600;
      case 'payment':
        return TW.emerald600;
      case 'checkin':
        return TW.blue600;
      case 'renewal':
        return TW.violet600;
      default:
        return TW.slate500;
    }
  }

  IconData _typeIcon(String type) {
    switch (type) {
      case 'expiry':
        return MSym.alarm;
      case 'payment':
        return MSym.payments;
      case 'checkin':
        return MSym.howToReg;
      case 'renewal':
        return MSym.autorenew;
      default:
        return MSym.notificationImportant;
    }
  }
}
