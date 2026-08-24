import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/colors.dart';

class CommunityScreen extends StatelessWidget {
  const CommunityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        title: Text(
          'Community',
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: Colors.black87,
          ),
        ),
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, color: Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 5,
        itemBuilder: (context, index) {
          return _buildPostCard(index);
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {},
        backgroundColor: AppColors.primaryBlue,
        child: const Icon(LucideIcons.edit3, color: Colors.white),
      ),
    );
  }

  Widget _buildPostCard(int index) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: AppColors.primaryBlue.withValues(alpha: 0.1),
                child: const Icon(LucideIcons.user, color: AppColors.primaryBlue),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Student ${index + 1}',
                      style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.black87),
                    ),
                    Text(
                      '2 hours ago',
                      style: GoogleFonts.inter(fontSize: 12, color: Colors.grey.shade500),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Has anyone found a black umbrella on Route 1? I think I left it there yesterday morning.',
            style: GoogleFonts.inter(fontSize: 14, color: Colors.black87, height: 1.5),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Row(
                children: [
                  Icon(LucideIcons.thumbsUp, size: 18, color: Colors.grey.shade500),
                  const SizedBox(width: 6),
                  Text('12', style: GoogleFonts.inter(fontSize: 13, color: Colors.grey.shade600)),
                ],
              ),
              const SizedBox(width: 24),
              Row(
                children: [
                  Icon(LucideIcons.messageSquare, size: 18, color: Colors.grey.shade500),
                  const SizedBox(width: 6),
                  Text('4', style: GoogleFonts.inter(fontSize: 13, color: Colors.grey.shade600)),
                ],
              ),
            ],
          )
        ],
      ),
    );
  }
}
