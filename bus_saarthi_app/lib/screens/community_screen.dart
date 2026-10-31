import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_selector/file_selector.dart' as fs;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../models/grievance_model.dart';
import '../providers/auth_provider.dart';
import '../providers/community_provider.dart';
import '../providers/language_provider.dart';
import '../services/api_client.dart';
import '../widgets/media_viewer.dart';
import 'home_screen.dart';

/// 1:1 port of the web Community page (grievance portal): blue navbar with
/// search/sort strip, filter pills, the feed of complaint cards, the
/// "My Complaints" window, the detail sheet and the create bottom sheet.
class CommunityScreen extends StatelessWidget {
  const CommunityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null) {
      return const Scaffold(body: SizedBox.shrink());
    }
    return ChangeNotifierProvider(
      create: (_) {
        final p = CommunityProvider(user);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          p.load();
          p.initOfflineQueue();
        });
        return p;
      },
      child: const _CommunityView(),
    );
  }
}

class _CommunityView extends StatefulWidget {
  const _CommunityView();

  @override
  State<_CommunityView> createState() => _CommunityViewState();
}

class _CommunityViewState extends State<_CommunityView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CommunityProvider>().attachToastContext(context);
    });
  }

  @override
  void dispose() {
    context.read<CommunityProvider>().disposeOfflineQueue();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LanguageProvider>();
    final community = context.watch<CommunityProvider>();
    final user = context.watch<AuthProvider>().user;
    if (user == null) {
      return const Scaffold(body: SizedBox.shrink());
    }
    final canCreateComplaint = !const {
      'admin',
      'tech_admin',
      'transport_incharge',
    }.contains(user.role.toLowerCase());

    // Schedule setLang for after build completes to avoid setState during build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      community.setLang(lang.lang);
    });

    return Scaffold(
      body: Column(
        children: [
          _Navbar(
            community: community,
            lang: lang,
            canCreateComplaint: canCreateComplaint,
          ),
          Expanded(
            child: community.showMyComplaints
                ? _MyComplaintsView(community: community, lang: lang)
                : _FeedView(community: community, lang: lang),
          ),
        ],
      ),
      floatingActionButton: !community.showMyComplaints && canCreateComplaint
          ? Padding(
              padding: const EdgeInsets.only(right: 16, bottom: 16),
              child: _CreateComplaintFab(
                onPressed: () => _showCreateComplaintSheet(context, community),
              ),
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
    );
  }
}

// ═══════════════════════════════ Navbar ═══════════════════════════════

class _Navbar extends StatelessWidget {
  final CommunityProvider community;
  final LanguageProvider lang;
  final bool canCreateComplaint;

  const _Navbar({
    required this.community,
    required this.lang,
    required this.canCreateComplaint,
  });

  @override
  Widget build(BuildContext context) {
    final showMy = community.showMyComplaints;
    final width = MediaQuery.sizeOf(context).width;
    final compact = width < 500;

    return Container(
      color: AppColors.primaryBlue,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Row 1
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 6, 10, 6),
              child: Row(
                children: [
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: () {
                      if (showMy) {
                        community.setShowMyComplaints(false);
                      } else {
                        Navigator.of(context).pushReplacement(
                          MaterialPageRoute(builder: (_) => const HomeScreen()),
                        );
                      }
                    },
                    icon: const Icon(
                      LucideIcons.arrowLeft,
                      size: 20,
                      color: Colors.white,
                    ),
                  ),
                  if (!compact) ...[
                    Container(
                      height: 28,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(7),
                      ),
                      child: Image.asset(
                        'assets/images/logo.png',
                        errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            if (showMy) ...[
                              const Icon(
                                LucideIcons.clipboardList,
                                size: 15,
                                color: Colors.white,
                              ),
                              const SizedBox(width: 6),
                            ],
                            Flexible(
                              child: Text(
                                showMy
                                    ? lang.t('myComplaints')
                                    : lang.t('grievancePortal'),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ],
                        ),
                        Text(
                          showMy
                              ? '${community.myComplaints.length} Total • '
                                    '${community.myComplaints.where((c) => c.status == 'pending' || c.status == 'in_progress').length} In Progress • '
                                    '${community.myComplaints.where((c) => c.status == 'closed').length} Closed'
                              : '${community.total} Total • '
                                    '${community.pendingCount} Open'
                                    '${community.awaitingCount > 0 ? ' • ${community.awaitingCount} Awaiting' : ''}'
                                    '${community.reopenedCount > 0 ? ' • ${community.reopenedCount} Reopened' : ''}'
                                    ' • ${community.closedCount} Closed',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.75),
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Right actions
                  if (showMy) ...[
                    _PillButton(
                      label: 'Feed',
                      onTap: () => community.setShowMyComplaints(false),
                    ),
                    if (canCreateComplaint) ...[
                      const SizedBox(width: 6),
                      _OrangePill(
                        label: 'New',
                        onTap: () =>
                            _showCreateComplaintSheet(context, community),
                      ),
                    ],
                  ] else ...[
                    if (canCreateComplaint)
                      _PillButton(
                        label: compact ? '' : lang.t('myComplaints'),
                        count: community.myComplaints.length,
                        icon: LucideIcons.clipboardList,
                        onTap: () => community.setShowMyComplaints(true),
                      ),
                    const SizedBox(width: 6),
                    _FilterPill(
                      active: community.showFilters,
                      label: lang.t('filter'),
                      showLabel: !compact,
                      onTap: community.toggleFilters,
                    ),
                  ],
                ],
              ),
            ),

            // Row 2: search + horizontally scrollable sort tabs
            if (!showMy)
              Container(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
                decoration: BoxDecoration(
                  border: Border(
                    top: BorderSide(
                      color: Colors.white.withValues(alpha: 0.10),
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(
                          minWidth: 100,
                          maxWidth: 280,
                        ),
                        child: Container(
                          height: 30,
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.25),
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                LucideIcons.search,
                                size: 13,
                                color: Colors.white.withValues(alpha: 0.6),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: TextField(
                                  onChanged: community.setSearchQuery,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                  ),
                                  cursorColor: Colors.white,
                                  decoration: InputDecoration(
                                    isDense: true,
                                    filled: false,
                                    fillColor: Colors.transparent,
                                    contentPadding: const EdgeInsets.symmetric(vertical: 6),
                                    border: InputBorder.none,
                                    enabledBorder: InputBorder.none,
                                    focusedBorder: InputBorder.none,
                                    disabledBorder: InputBorder.none,
                                    errorBorder: InputBorder.none,
                                    hintText: 'Search...',
                                    hintStyle: TextStyle(
                                      color: Colors.white.withValues(
                                        alpha: 0.55,
                                      ),
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 3,
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            for (final tab in const [
                              ('newest', 'New'),
                              ('priority', 'Priority'),
                              ('most_agreed', 'Top'),
                              ('oldest', 'Old'),
                            ]) ...[
                              const SizedBox(width: 4),
                              _SortTab(
                                label: tab.$2,
                                active: community.sortBy == tab.$1,
                                onTap: () => community.setSortBy(tab.$1),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // Filter pills
            if (community.showFilters && !showMy)
              Container(
                padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
                decoration: BoxDecoration(
                  border: Border(
                    top: BorderSide(
                      color: Colors.white.withValues(alpha: 0.15),
                    ),
                  ),
                ),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final s in const [
                      'all',
                      'pending',
                      'in_progress',
                      'resolved',
                      'reopened',
                      'closed',
                    ])
                      _StatusFilterPill(
                        label: s == 'all' ? 'All' : StatusMeta.of(s).label,
                        active: community.filterStatus == s,
                        onTap: () => community.setFilterStatus(s),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

void _showCreateComplaintSheet(
  BuildContext context,
  CommunityProvider community,
) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => ChangeNotifierProvider.value(
      value: community,
      child: const _CreateComplaintSheet(),
    ),
  );
}

class _PillButton extends StatelessWidget {
  final String label;
  final int? count;
  final IconData? icon;
  final VoidCallback onTap;

  const _PillButton({
    required this.label,
    this.count,
    this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.15),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: Colors.white.withValues(alpha: 0.20)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 13, color: Colors.white),
                if (label.isNotEmpty) const SizedBox(width: 4),
              ],
              if (label.isNotEmpty)
                Flexible(
                  child: Text(
                    label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              if (count != null && count! > 0) ...[
                const SizedBox(width: 5),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 5,
                    vertical: 1,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.30),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '$count',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 9.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _CreateComplaintFab extends StatelessWidget {
  final VoidCallback onPressed;

  const _CreateComplaintFab({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 60,
      height: 60,
      child: FloatingActionButton(
        heroTag: 'community-create-complaint',
        onPressed: onPressed,
        backgroundColor: AppColors.secondaryOrange,
        foregroundColor: Colors.white,
        elevation: 7,
        shape: const CircleBorder(),
        child: const Icon(LucideIcons.plus, size: 27),
      ),
    );
  }
}

class _OrangePill extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _OrangePill({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.secondaryOrange,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          child: Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  final bool active;
  final String label;
  final bool showLabel;
  final VoidCallback onTap;

  const _FilterPill({
    required this.active,
    required this.label,
    required this.showLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? Colors.white : Colors.white.withValues(alpha: 0.15),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: active
                  ? Colors.white
                  : Colors.white.withValues(alpha: 0.20),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                LucideIcons.slidersHorizontal,
                size: 13,
                color: active ? const Color(0xFF1D3A6E) : Colors.white,
              ),
              if (showLabel) ...[
                const SizedBox(width: 5),
                Text(
                  label,
                  style: TextStyle(
                    color: active ? const Color(0xFF1D3A6E) : Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SortTab extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _SortTab({
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? Colors.white : Colors.white.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: active
                  ? const Color(0xFF1D3A6E)
                  : Colors.white.withValues(alpha: 0.9),
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusFilterPill extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _StatusFilterPill({
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active
          ? const Color(0xFF22C55E)
          : Colors.white.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: active
                  ? const Color(0xFF4ADE80)
                  : Colors.white.withValues(alpha: 0.20),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: active
                  ? Colors.white
                  : Colors.white.withValues(alpha: 0.9),
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════ Feed view ═══════════════════════════

class _FeedView extends StatelessWidget {
  final CommunityProvider community;
  final LanguageProvider lang;

  const _FeedView({required this.community, required this.lang});

  @override
  Widget build(BuildContext context) {
    if (community.isLoading) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (var i = 0; i < 3; i++) ...[
            const _ComplaintSkeleton(),
            const SizedBox(height: 18),
          ],
        ],
      );
    }

    final list = community.filteredComplaints;
    if (list.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              LucideIcons.shieldAlert,
              size: 40,
              color: Theme.of(
                context,
              ).colorScheme.onSurface.withValues(alpha: 0.4),
            ),
            const SizedBox(height: 14),
            Text(
              lang.t('noComplaintsFound'),
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            Text(
              lang.t('tryAdjustingFilters'),
              style: TextStyle(
                fontSize: 13,
                color: Theme.of(
                  context,
                ).colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: community.load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: list.length,
        itemBuilder: (context, i) => Padding(
          padding: const EdgeInsets.only(bottom: 18),
          child: _GrievanceCard(
            grievance: list[i],
            community: community,
            lang: lang,
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════ Grievance card ═══════════════════════

class _GrievanceCard extends StatelessWidget {
  final Grievance grievance;
  final CommunityProvider community;
  final LanguageProvider lang;

  const _GrievanceCard({
    required this.grievance,
    required this.community,
    required this.lang,
  });

  Color get _leftBorderColor {
    switch (grievance.status) {
      case 'closed':
        return const Color(0xFF28A745);
      case 'resolved':
        return const Color(0xFF0958D9);
      case 'in_progress':
        return const Color(0xFFD46B08);
      default:
        return const Color(0xFFCF1322);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textDark = isDark ? AppColors.darkText : AppColors.lightText;
    final textLight = isDark
        ? AppColors.darkTextMuted
        : AppColors.lightTextMuted;
    final cardBg = isDark ? AppColors.darkCard : AppColors.lightCard;
    final borderColor = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final isMine = grievance.isMine;

    return Container(
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderColor, width: 1),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.35)
                : const Color(0xFF0F172A).withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.20)
                : const Color(0xFF0F172A).withValues(alpha: 0.02),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: () => _openDetail(context),
            child: Stack(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 18, 16, 18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: isMine
                                  ? AppColors.primaryBlue
                                      .withValues(alpha: isDark ? 0.22 : 0.10)
                                  : (isDark
                                      ? AppColors.darkSecondary
                                      : const Color(0xFFF1F5F9)),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              LucideIcons.userCircle2,
                              size: 22,
                              color: isMine ? AppColors.primaryBlue : textLight,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  isMine
                                      ? lang.t('yourComplaint')
                                      : lang.t('anonymousPassenger'),
                                  style: TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w700,
                                    color: textDark,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    Icon(LucideIcons.bus,
                                        size: 12, color: textLight),
                                    const SizedBox(width: 4),
                                    Flexible(
                                      child: Text(
                                        '${community.formatRoute(grievance.route, grievance.busNumber)} • ${community.formatTime(grievance.createdAt)}',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: textLight,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Badges
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              _StatusBadge(status: grievance.status),
                              const SizedBox(height: 4),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  _TicketBadge(
                                      id: grievance.id, isDark: isDark),
                                  if (grievance.category != null &&
                                      grievance.category!.isNotEmpty) ...[
                                    const SizedBox(width: 4),
                                    _CategoryBadge(
                                        category: grievance.category!),
                                  ],
                                  if (grievance.reopenCount > 0 &&
                                      grievance.status != 'closed') ...[
                                    const SizedBox(width: 4),
                                    _ReopenBadge(
                                        count: grievance.reopenCount),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),

                      const SizedBox(height: 14),

                      // Text
                      Text(
                        grievance.text,
                        style: TextStyle(
                            fontSize: 14, height: 1.5, color: textDark),
                      ),

                      // Media
                      if (grievance.type == 'photo' &&
                          grievance.mediaUrl != null) ...[
                        const SizedBox(height: 12),
                        GestureDetector(
                          onTap: () => showMedia(
                            context,
                            type: 'photo',
                            url: grievance.mediaUrl!,
                          ),
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: isDark
                                    ? AppColors.darkBorder
                                    : const Color(0xFFE2E8F0),
                              ),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(14),
                              child: Container(
                                constraints:
                                    const BoxConstraints(maxHeight: 280),
                                width: double.infinity,
                                color: isDark
                                    ? AppColors.darkBg
                                    : const Color(0xFFF8FAFC),
                                child: CachedNetworkImage(
                                  imageUrl: grievance.mediaUrl!,
                                  fit: BoxFit.contain,
                                  errorWidget: (_, __, ___) =>
                                      const SizedBox.shrink(),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                      if (grievance.type == 'video' &&
                          grievance.mediaUrl != null) ...[
                        const SizedBox(height: 10),
                        _MediaRowButton(
                          icon: LucideIcons.play,
                          iconBg: AppColors.primaryBlue,
                          title: 'Video attachment',
                          subtitle: 'Tap to play',
                          isDark: isDark,
                          onTap: () => showMedia(
                            context,
                            type: 'video',
                            url: grievance.mediaUrl!,
                          ),
                        ),
                      ],
                      if (grievance.type == 'audio' &&
                          grievance.mediaUrl != null) ...[
                        const SizedBox(height: 10),
                        _MediaRowButton(
                          icon: LucideIcons.mic,
                          iconBg: AppColors.secondaryOrange,
                          title: 'Audio attachment',
                          subtitle: 'Tap to listen',
                          isDark: isDark,
                          onTap: () => showMedia(
                            context,
                            type: 'audio',
                            url: grievance.mediaUrl!,
                          ),
                        ),
                      ],

                      // Admin response (mine only, like the web)
                      if (grievance.adminResponse != null &&
                          grievance.adminResponse!.isNotEmpty &&
                          isMine) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.primaryBlue
                                .withValues(alpha: 0.06),
                            borderRadius: BorderRadius.circular(8),
                            border: Border(
                              left: BorderSide(
                                  color: AppColors.primaryBlue, width: 3),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'RESPONSE FROM THE TRANSPORT TEAM',
                                style: TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.4,
                                  color: AppColors.primaryBlue,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                grievance.adminResponse!,
                                style: TextStyle(
                                  fontSize: 13,
                                  height: 1.5,
                                  color: textDark,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      const SizedBox(height: 14),

                      // Action bar
                      Row(
                        children: [
                          // Upvote styled as an interactive pill chip
                          Container(
                            decoration: BoxDecoration(
                              color: grievance.hasUpvotedLocally
                                  ? AppColors.primaryBlue
                                  : (isDark
                                      ? const Color(0xFF1E293B)
                                      : const Color(0xFFF1F5F9)),
                              borderRadius: BorderRadius.circular(30),
                              border: Border.all(
                                color: grievance.hasUpvotedLocally
                                    ? AppColors.primaryBlue
                                    : (isDark
                                        ? const Color(0xFF334155)
                                        : const Color(0xFFE2E8F0)),
                              ),
                            ),
                            child: Material(
                              color: Colors.transparent,
                              borderRadius: BorderRadius.circular(30),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(30),
                                onTap: isMine
                                    ? null
                                    : () => community.upvote(grievance.id),
                                child: Opacity(
                                  opacity: isMine ? 0.6 : 1,
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 7,
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          LucideIcons.thumbsUp,
                                          size: 15,
                                          color: grievance.hasUpvotedLocally
                                              ? Colors.white
                                              : AppColors.primaryBlue,
                                        ),
                                        const SizedBox(width: 7),
                                        Text(
                                          '${grievance.upvotes} ${grievance.hasUpvotedLocally ? 'Agreed' : lang.t('agree')}',
                                          style: TextStyle(
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.w600,
                                            color: grievance.hasUpvotedLocally
                                                ? Colors.white
                                                : (isDark
                                                    ? Colors.white
                                                    : const Color(0xFF1E293B)),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const Spacer(),
                          // View details hint
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'View details',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w500,
                                  color: textLight,
                                ),
                              ),
                              const SizedBox(width: 2),
                              Icon(
                                LucideIcons.chevronRight,
                                size: 14,
                                color: textLight,
                              ),
                            ],
                          ),
                        ],
                      ),
                      // Confirm/reopen actions when resolved (mine) - dedicated 50/50 responsive bar
                      if (isMine && grievance.status == 'resolved') ...[
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: _SmallAction(
                                color: const Color(0xFF28A745),
                                icon: LucideIcons.check,
                                label: 'Yes, Fixed',
                                onTap: () => community.confirmFix(grievance.id),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _SmallAction(
                                color: const Color(0xFFCF1322),
                                icon: LucideIcons.rotateCcw,
                                label: 'Not Fixed',
                                onTap: () => _openRejectDialog(context),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                // Left status accent vertical strip
                Positioned(
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: 5.5,
                  child: Container(
                    color: _leftBorderColor,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _openDetail(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChangeNotifierProvider.value(
        value: community,
        child: _DetailSheet(grievance: grievance),
      ),
    );
  }

  void _openRejectDialog(BuildContext context) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Not fixed yet'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Tell the transport team what is still wrong:'),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'e.g. The AC is still not cooling',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(lang.t('cancel')),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              community.reopen(grievance.id, controller.text.trim());
            },
            child: const Text(
              'Reopen',
              style: TextStyle(
                color: Color(0xFFCF1322),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Small badges ──

class _TicketBadge extends StatelessWidget {
  final String id;
  final bool isDark;

  const _TicketBadge({required this.id, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSecondary : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
          width: 0.8,
        ),
      ),
      child: Text(
        '#${id.length >= 6 ? id.substring(0, 6).toUpperCase() : id.toUpperCase()}',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          fontFamily: 'monospace',
          color: isDark ? AppColors.darkTextMuted : AppColors.lightTextMuted,
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final meta = StatusMeta.of(status);
    final label = status == 'resolved' ? 'Awaiting Confirm' : meta.label;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
      decoration: BoxDecoration(
        color: Color(meta.bg),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          color: Color(meta.color),
        ),
      ),
    );
  }
}

class _CategoryBadge extends StatelessWidget {
  final String category;

  const _CategoryBadge({required this.category});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0x1A1877F2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        category,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: AppColors.primaryBlue,
        ),
      ),
    );
  }
}

class _ReopenBadge extends StatelessWidget {
  final int count;

  const _ReopenBadge({required this.count});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF1F0),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        '×$count Reopened',
        style: const TextStyle(
          fontSize: 9.5,
          fontWeight: FontWeight.w700,
          color: Color(0xFFCF1322),
        ),
      ),
    );
  }
}

class _MediaRowButton extends StatelessWidget {
  final IconData icon;
  final Color iconBg;
  final String title;
  final String subtitle;
  final bool isDark;
  final VoidCallback onTap;

  const _MediaRowButton({
    required this.icon,
    required this.iconBg,
    required this.title,
    required this.subtitle,
    required this.isDark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isDark ? AppColors.darkBg : AppColors.lightBg,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: iconBg,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 18, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppColors.darkText : AppColors.lightText,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 11.5,
                      color: isDark
                          ? AppColors.darkTextMuted
                          : AppColors.lightTextMuted,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SmallAction extends StatelessWidget {
  final Color color;
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _SmallAction({
    required this.color,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.28),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: color,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 15, color: Colors.white),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 12.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ComplaintSkeleton extends StatelessWidget {
  const _ComplaintSkeleton();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final shimmer = (isDark ? AppColors.darkBorder : AppColors.lightBorder)
        .withValues(alpha: 0.5);
    Widget block(double h, {double w = double.infinity}) => Container(
      height: h,
      width: w,
      decoration: BoxDecoration(
        color: shimmer,
        borderRadius: BorderRadius.circular(8),
      ),
    );
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              block(40, w: 40),
              const SizedBox(width: 12),
              Expanded(child: block(16)),
            ],
          ),
          const SizedBox(height: 14),
          block(14),
          const SizedBox(height: 8),
          block(14, w: 220),
          const SizedBox(height: 14),
          block(34, w: 120),
        ],
      ),
    );
  }
}

// ═══════════════════════ My complaints view ═══════════════════════

class _MyComplaintsView extends StatelessWidget {
  final CommunityProvider community;
  final LanguageProvider lang;

  const _MyComplaintsView({required this.community, required this.lang});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textDark = isDark ? AppColors.darkText : AppColors.lightText;
    final textLight = isDark
        ? AppColors.darkTextMuted
        : AppColors.lightTextMuted;
    final borderColor = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final cardBg = isDark ? AppColors.darkCard : AppColors.lightCard;
    final bgSoft = isDark ? AppColors.darkBg : AppColors.lightBg;

    final list = community.myComplaints;

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: list.isEmpty ? 3 : list.length + 4,
      itemBuilder: (context, index) {
        if (index == 0) {
          // Nav row (responsive 50/50 split so buttons never overflow)
          return Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: Row(
              children: [
                Expanded(
                  child: Material(
                    color: cardBg,
                    borderRadius: BorderRadius.circular(24),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(24),
                      onTap: () => community.setShowMyComplaints(false),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 9,
                        ),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: borderColor),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              LucideIcons.arrowLeft,
                              size: 15,
                              color: textDark,
                            ),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                'Community',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: textDark,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Material(
                    color: AppColors.secondaryOrange,
                    borderRadius: BorderRadius.circular(24),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(24),
                      onTap: () => _showCreateComplaintSheet(context, community),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 9,
                        ),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.secondaryOrange.withValues(
                                alpha: 0.30,
                              ),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              LucideIcons.plus,
                              size: 15,
                              color: Colors.white,
                            ),
                            SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                'Raise Complaint',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        }

        if (index == 1) {
          // Hero card
          return Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: Container(
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: borderColor, width: 1),
                boxShadow: [
                  BoxShadow(
                    color: isDark
                        ? Colors.black.withValues(alpha: 0.35)
                        : const Color(0xFF0F172A).withValues(alpha: 0.05),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                  BoxShadow(
                    color: isDark
                        ? Colors.black.withValues(alpha: 0.20)
                        : const Color(0xFF0F172A).withValues(alpha: 0.02),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Stack(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(22, 20, 20, 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                LucideIcons.clipboardList,
                                size: 21,
                                color: AppColors.primaryBlue,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'My Raised Complaints',
                                  style: TextStyle(
                                    fontSize: 19,
                                    fontWeight: FontWeight.w800,
                                    color: textDark,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Track issues you have raised. When the transport team marks a complaint as fixed, you can confirm it or reopen if not satisfied.',
                            style: TextStyle(
                              fontSize: 13,
                              height: 1.45,
                              color: textLight,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: _StatChip(
                                  label: 'Total',
                                  value: '${list.length}',
                                  bg: bgSoft,
                                  borderColor: borderColor,
                                  valueColor: textDark,
                                  labelColor: textLight,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: _StatChip(
                                  label: 'In Progress',
                                  value:
                                      '${list.where((c) => c.status == 'pending' || c.status == 'in_progress' || c.status == 'reopened').length}',
                                  bg: const Color(0xFFFFF7E6),
                                  borderColor: const Color(0xFFFFE7BA),
                                  valueColor: const Color(0xFFD46B08),
                                  labelColor: const Color(0xFFD46B08),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: _StatChip(
                                  label: 'Awaiting',
                                  value:
                                      '${list.where((c) => c.status == 'resolved').length}',
                                  bg: const Color(0xFFE6F4FF),
                                  borderColor: const Color(0xFFBAE0FF),
                                  valueColor: const Color(0xFF0958D9),
                                  labelColor: const Color(0xFF0958D9),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: _StatChip(
                                  label: 'Closed',
                                  value:
                                      '${list.where((c) => c.status == 'closed').length}',
                                  bg: const Color(0xFFE6FAE6),
                                  borderColor: const Color(0xFFB7EB8F),
                                  valueColor: const Color(0xFF28A745),
                                  labelColor: const Color(0xFF28A745),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Positioned(
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: 5.5,
                      child: Container(
                        color: AppColors.primaryBlue,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        if (list.isEmpty) {
          if (index == 2) {
            // Empty state
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  vertical: 52,
                  horizontal: 24,
                ),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: borderColor),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 66,
                      height: 66,
                      decoration: BoxDecoration(
                        color: AppColors.primaryBlue.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        LucideIcons.clipboardList,
                        size: 32,
                        color: AppColors.primaryBlue,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'No Complaints Raised',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: textDark,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'You have not submitted any complaints yet. If you notice any issue with the bus service, drivers, or route, let the transport team know.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        height: 1.5,
                        color: textLight,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }
          // index == 3 - Return button
          return Center(
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(24),
                onTap: () => community.setShowMyComplaints(false),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 9,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: borderColor),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.arrowLeft, size: 13, color: textLight),
                      const SizedBox(width: 7),
                      Text(
                        'Return to Community Feed',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: textLight,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }

        // List has items: index 2..(2+list.length-1) = cards, last = return button
        if (index < 2 + list.length) {
          final comp = list[index - 2];
          return Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: _GrievanceCard(
              grievance: comp,
              community: community,
              lang: lang,
            ),
          );
        }

        // Last item: return button
        return Padding(
          padding: const EdgeInsets.only(top: 18, bottom: 8),
          child: Center(
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(24),
                onTap: () => community.setShowMyComplaints(false),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 9,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: borderColor),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.arrowLeft, size: 13, color: textLight),
                      const SizedBox(width: 7),
                      Text(
                        'Return to Community Feed',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: textLight,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final Color bg;
  final Color borderColor;
  final Color valueColor;
  final Color labelColor;

  const _StatChip({
    required this.label,
    required this.value,
    required this.bg,
    required this.borderColor,
    required this.valueColor,
    required this.labelColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              label,
              maxLines: 1,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
                color: labelColor,
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════ Detail sheet ═══════════════════════

class _DetailSheet extends StatelessWidget {
  final Grievance grievance;

  const _DetailSheet({required this.grievance});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textDark = isDark ? AppColors.darkText : AppColors.lightText;
    final textLight = isDark
        ? AppColors.darkTextMuted
        : AppColors.lightTextMuted;
    final borderColor = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final cardBg = isDark ? AppColors.darkCard : AppColors.lightCard;
    final meta = StatusMeta.of(grievance.status);
    final community = context.read<CommunityProvider>();

    String fmt(DateTime? d) => d == null
        ? ''
        : '${d.day.toString().padLeft(2, '0')} ${_month(d.month)} ${d.year}, ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: borderColor)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Color(meta.bg),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    LucideIcons.shieldAlert,
                    size: 18,
                    color: Color(meta.color),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Complaint #${grievance.id.length >= 6 ? grievance.id.substring(0, 6).toUpperCase() : grievance.id}',
                        style: TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w800,
                          color: textDark,
                        ),
                      ),
                      const SizedBox(height: 2),
                      _StatusBadge(status: grievance.status),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Icon(LucideIcons.x, size: 20, color: textLight),
                ),
              ],
            ),
          ),

          // Body
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Reporter line
                  Row(
                    children: [
                      Icon(LucideIcons.bus, size: 12, color: textLight),
                      const SizedBox(width: 5),
                      Flexible(
                        child: Text(
                          community.formatRoute(
                            grievance.route,
                            grievance.busNumber,
                          ),
                          style: TextStyle(fontSize: 12, color: textLight),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  Text(
                    'WHAT WAS REPORTED',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                      color: textLight,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    grievance.text,
                    style: TextStyle(
                      fontSize: 14.5,
                      height: 1.55,
                      color: textDark,
                    ),
                  ),

                  // Media
                  if (grievance.mediaUrl != null &&
                      grievance.type == 'photo') ...[
                    const SizedBox(height: 16),
                    GestureDetector(
                      onTap: () => showMedia(
                        context,
                        type: 'photo',
                        url: grievance.mediaUrl!,
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: CachedNetworkImage(
                          imageUrl: grievance.mediaUrl!,
                          maxHeightDiskCache: 800,
                          errorWidget: (_, __, ___) => const SizedBox.shrink(),
                        ),
                      ),
                    ),
                  ],
                  if (grievance.mediaUrl != null &&
                      grievance.type == 'video') ...[
                    const SizedBox(height: 16),
                    _MediaRowButton(
                      icon: LucideIcons.play,
                      iconBg: AppColors.primaryBlue,
                      title: 'Video attachment',
                      subtitle: 'Tap to play',
                      isDark: isDark,
                      onTap: () => showMedia(
                        context,
                        type: 'video',
                        url: grievance.mediaUrl!,
                      ),
                    ),
                  ],

                  const SizedBox(height: 20),

                  // Timeline
                  Text(
                    'TIMELINE',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                      color: textLight,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.only(left: 14),
                    decoration: BoxDecoration(
                      border: Border(
                        left: BorderSide(color: borderColor, width: 2),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _TimelineRow(
                          icon: LucideIcons.shieldAlert,
                          tone: const Color(0xFFCF1322),
                          label: 'Raised',
                          value: fmt(grievance.createdAt),
                          isDark: isDark,
                        ),
                        if (grievance.resolvedAt != null) ...[
                          const SizedBox(height: 10),
                          _TimelineRow(
                            icon: LucideIcons.wrench,
                            tone: const Color(0xFFD46B08),
                            label: 'Marked as fixed',
                            value: fmt(grievance.resolvedAt),
                            isDark: isDark,
                          ),
                        ],
                        if (grievance.reopenCount > 0) ...[
                          const SizedBox(height: 10),
                          _TimelineRow(
                            icon: LucideIcons.rotateCcw,
                            tone: const Color(0xFFCF1322),
                            label: 'Reopened',
                            value:
                                '${grievance.reopenCount} time(s) — the complainant said it was not fixed',
                            isDark: isDark,
                          ),
                        ],
                        if (grievance.confirmedAt != null) ...[
                          const SizedBox(height: 10),
                          _TimelineRow(
                            icon: LucideIcons.check,
                            tone: const Color(0xFF28A745),
                            label: 'Confirmed and closed',
                            value: fmt(grievance.confirmedAt),
                            isDark: isDark,
                          ),
                        ],
                      ],
                    ),
                  ),

                  // Handling info
                  if (grievance.resolvedBy != null ||
                      grievance.resolutionNote != null) ...[
                    const SizedBox(height: 18),
                    Wrap(
                      spacing: 14,
                      runSpacing: 6,
                      children: [
                        if (grievance.resolvedBy != null)
                          Text.rich(
                            TextSpan(
                              text: 'Handled by: ',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: textDark,
                              ),
                              children: [
                                TextSpan(
                                  text: grievance.resolvedBy!,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w400,
                                    color: textLight,
                                  ),
                                ),
                              ],
                            ),
                            style: const TextStyle(fontSize: 12),
                          ),
                        if (grievance.resolutionNote != null)
                          Text.rich(
                            TextSpan(
                              text: 'Internal note: ',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: textDark,
                              ),
                              children: [
                                TextSpan(
                                  text: grievance.resolutionNote!,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w400,
                                    color: textLight,
                                  ),
                                ),
                              ],
                            ),
                            style: const TextStyle(fontSize: 12),
                          ),
                      ],
                    ),
                  ],

                  // Response
                  if (grievance.adminResponse != null &&
                      grievance.adminResponse!.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    Container(
                      padding: const EdgeInsets.all(13),
                      decoration: BoxDecoration(
                        color: AppColors.primaryBlue.withValues(alpha: 0.06),
                        borderRadius: BorderRadius.circular(8),
                        border: Border(
                          left: BorderSide(
                            color: AppColors.primaryBlue,
                            width: 3,
                          ),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'RESPONSE FROM THE TRANSPORT TEAM',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.4,
                              color: AppColors.primaryBlue,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            grievance.adminResponse!,
                            style: TextStyle(
                              fontSize: 13.5,
                              height: 1.5,
                              color: textDark,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          // Actions
          if (grievance.isMine && grievance.status == 'resolved')
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: borderColor)),
                color: cardBg,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _SmallAction(
                      color: const Color(0xFF28A745),
                      icon: LucideIcons.check,
                      label: 'Yes, Fixed',
                      onTap: () {
                        Navigator.pop(context);
                        community.confirmFix(grievance.id);
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _SmallAction(
                      color: const Color(0xFFCF1322),
                      icon: LucideIcons.rotateCcw,
                      label: 'Not Fixed',
                      onTap: () {
                        Navigator.pop(context);
                        _askReopen(context, community);
                      },
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  void _askReopen(BuildContext context, CommunityProvider community) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Not fixed yet'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Tell the transport team what is still wrong:'),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'e.g. The AC is still not cooling',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(context.read<LanguageProvider>().t('cancel')),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              community.reopen(grievance.id, controller.text.trim());
            },
            child: const Text(
              'Reopen',
              style: TextStyle(
                color: Color(0xFFCF1322),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _month(int m) => [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
][m - 1];

class _TimelineRow extends StatelessWidget {
  final IconData icon;
  final Color tone;
  final String label;
  final String value;
  final bool isDark;

  const _TimelineRow({
    required this.icon,
    required this.tone,
    required this.label,
    required this.value,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(color: tone, shape: BoxShape.circle),
          child: Icon(icon, size: 11, color: Colors.white),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: isDark ? AppColors.darkText : AppColors.lightText,
                ),
              ),
              Text(
                value,
                style: TextStyle(
                  fontSize: 11.5,
                  color: isDark
                      ? AppColors.darkTextMuted
                      : AppColors.lightTextMuted,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════ Create complaint sheet ═══════════════════════

class _CreateComplaintSheet extends StatefulWidget {
  const _CreateComplaintSheet();

  @override
  State<_CreateComplaintSheet> createState() => _CreateComplaintSheetState();
}

class _CreateComplaintSheetState extends State<_CreateComplaintSheet> {
  final TextEditingController _text = TextEditingController();
  String? _category;
  String _mediaType = 'text';
  String? _mediaPath;
  String? _mediaName;
  bool _showMyName = false;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _pickMedia(String type) async {
    setState(() => _mediaType = type);
    try {
      if (type == 'photo') {
        final picked = await ImagePicker().pickImage(
          source: ImageSource.gallery,
          maxWidth: 1920,
        );
        if (picked != null && mounted) {
          setState(() {
            _mediaPath = picked.path;
            _mediaName = picked.name;
          });
        }
      } else if (type == 'video') {
        final picked = await ImagePicker().pickVideo(
          source: ImageSource.gallery,
        );
        if (picked != null && mounted) {
          setState(() {
            _mediaPath = picked.path;
            _mediaName = picked.name;
          });
        }
      } else {
        const group = fs.XTypeGroup(label: 'Audio', mimeTypes: ['audio/*']);
        final file = await fs.openFile(acceptedTypeGroups: [group]);
        if (file != null) {
          setState(() {
            _mediaPath = file.path;
            _mediaName = file.name;
          });
        }
      }
    } catch (_) {
      if (mounted) {
        ApiClient.toast(
          context,
          'Could not open the file picker.',
          kind: ToastKind.error,
        );
      }
    }
  }

  Future<void> _submit() async {
    final community = context.read<CommunityProvider>();
    final ok = await community.createComplaint(
      text: _text.text.trim(),
      category: _category,
      mediaPath: _mediaPath,
      mediaType: _mediaType,
      showMyName: _showMyName,
    );
    if (ok && mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final community = context.watch<CommunityProvider>();
    final lang = context.watch<LanguageProvider>();
    final user = context.watch<AuthProvider>().user;
    if (user == null) {
      return const SizedBox.shrink();
    }
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textDark = isDark ? AppColors.darkText : AppColors.lightText;
    final textLight = isDark
        ? AppColors.darkTextMuted
        : AppColors.lightTextMuted;
    final borderColor = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final cardBg = isDark ? AppColors.darkCard : AppColors.lightCard;
    final bgSoft = isDark ? AppColors.darkBg : AppColors.lightBg;

    return Align(
      alignment: Alignment.bottomCenter,
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Container(
          constraints: BoxConstraints(
            maxWidth: 600,
            maxHeight: MediaQuery.of(context).size.height * 0.9,
          ),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 40,
                offset: Offset(0, -10),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              lang.t('raiseComplaint'),
                              style: TextStyle(
                                fontSize: 19,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primaryBlue,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              'Other passengers see complaints anonymously. Transport staff can see your name for moderation.',
                              style: TextStyle(
                                fontSize: 12.5,
                                color: textLight,
                              ),
                            ),
                            if (user.routeId != null &&
                                user.routeId!.isNotEmpty) ...[
                              const SizedBox(height: 5),
                              Row(
                                children: [
                                  Icon(
                                    LucideIcons.bus,
                                    size: 13,
                                    color: AppColors.primaryBlue,
                                  ),
                                  const SizedBox(width: 5),
                                  Flexible(
                                    child: Text(
                                      'Filed against your route: ${community.formatRoute(user.routeId, null)}',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.primaryBlue,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                      Material(
                        color: bgSoft,
                        shape: const CircleBorder(),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: () => Navigator.pop(context),
                          child: Padding(
                            padding: const EdgeInsets.all(8),
                            child: Icon(
                              LucideIcons.x,
                              size: 22,
                              color: textDark,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // Categories
                  Text(
                    'Category (optional)',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: textDark,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: grievanceCategories.map((cat) {
                      final active = _category == cat;
                      return Material(
                        color: active ? AppColors.primaryBlue : bgSoft,
                        borderRadius: BorderRadius.circular(20),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(20),
                          onTap: () =>
                              setState(() => _category = active ? null : cat),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 11,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: borderColor),
                            ),
                            child: Text(
                              cat,
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w600,
                                color: active ? Colors.white : textDark,
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),

                  // Anonymous toggle
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: bgSoft,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: borderColor),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Post anonymously',
                                style: TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                  color: textDark,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Other passengers see complaints anonymously. Transport staff can see your name for moderation.',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  color: textLight,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        // Web-style toggle: blue when anonymous, green when named
                        GestureDetector(
                          onTap: () =>
                              setState(() => _showMyName = !_showMyName),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            width: 46,
                            height: 26,
                            padding: const EdgeInsets.all(3),
                            decoration: BoxDecoration(
                              color: _showMyName
                                  ? const Color(0xFF28A745)
                                  : AppColors.primaryBlue,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: AnimatedAlign(
                              duration: const Duration(milliseconds: 200),
                              alignment: _showMyName
                                  ? Alignment.centerRight
                                  : Alignment.centerLeft,
                              child: Container(
                                width: 20,
                                height: 20,
                                decoration: const BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Color(0x40000000),
                                      blurRadius: 3,
                                      offset: Offset(0, 1),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Text field
                  TextField(
                    controller: _text,
                    maxLines: 4,
                    maxLength: 2000,
                    style: TextStyle(fontSize: 15, color: textDark),
                    decoration: InputDecoration(
                      hintText:
                          "What's the issue? (e.g. Bus is overcrowded, Rash driving...)",
                      hintStyle: TextStyle(
                        color: textLight.withValues(alpha: 0.7),
                        fontSize: 13.5,
                      ),
                      counterStyle: TextStyle(fontSize: 10.5, color: textLight),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Media buttons
                  Row(
                    children: [
                      _MediaPickButton(
                        icon: LucideIcons.image,
                        iconColor: AppColors.primaryBlue,
                        activeBg: const Color(0xFFE6F0FA),
                        label: lang.t('photo'),
                        active: _mediaType == 'photo',
                        borderColor: borderColor,
                        textDark: textDark,
                        onTap: () => _pickMedia('photo'),
                      ),
                      const SizedBox(width: 10),
                      _MediaPickButton(
                        icon: LucideIcons.video,
                        iconColor: const Color(0xFFCF1322),
                        activeBg: const Color(0xFFFDECED),
                        label: lang.t('video'),
                        active: _mediaType == 'video',
                        borderColor: borderColor,
                        textDark: textDark,
                        onTap: () => _pickMedia('video'),
                      ),
                      const SizedBox(width: 10),
                      _MediaPickButton(
                        icon: LucideIcons.mic,
                        iconColor: AppColors.secondaryOrange,
                        activeBg: const Color(0xFFFFF0E6),
                        label: lang.t('audio'),
                        active: _mediaType == 'audio',
                        borderColor: borderColor,
                        textDark: textDark,
                        onTap: () => _pickMedia('audio'),
                      ),
                      const Spacer(),
                      if (_mediaName != null)
                        Flexible(
                          child: Text(
                            _mediaName!.length > 15
                                ? '${_mediaName!.substring(0, 15)}...'
                                : _mediaName!,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primaryBlue,
                            ),
                          ),
                        ),
                    ],
                  ),
                  if (_mediaPath != null && _mediaType == 'photo') ...[
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 160),
                        child: Image.file(
                          File(_mediaPath!),
                          fit: BoxFit.contain,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),

                  // Submit
                  Material(
                    color: AppColors.primaryBlue,
                    borderRadius: BorderRadius.circular(12),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: community.isSubmitting ? null : _submit,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: AppShadows.primaryGlow,
                        ),
                        child: community.isSubmitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.2,
                                  valueColor: AlwaysStoppedAnimation(
                                    Colors.white,
                                  ),
                                ),
                              )
                            : Text(
                                community.isSubmitting
                                    ? 'Posting...'
                                    : 'Post Complaint',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 16.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MediaPickButton extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final Color activeBg;
  final String label;
  final bool active;
  final Color borderColor;
  final Color textDark;
  final VoidCallback onTap;

  const _MediaPickButton({
    required this.icon,
    required this.iconColor,
    required this.activeBg,
    required this.label,
    required this.active,
    required this.borderColor,
    required this.textDark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? activeBg : Colors.transparent,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: borderColor),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 17, color: iconColor),
              const SizedBox(width: 7),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: textDark,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
