import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../core/colors.dart';
import '../providers/auth_provider.dart';
import '../providers/lang_provider.dart';
import '../widgets/floating_background.dart';
import '../services/api_service.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  int _currentIndex = 0;
  List<dynamic> _usersList = [];
  List<dynamic> _routesList = [];
  List<dynamic> _grievancesList = [];
  bool _isLoadingUsers = true;
  bool _isLoadingRoutes = true;
  bool _isLoadingGrievances = true;

  @override
  void initState() {
    super.initState();
    _fetchUsers();
    _fetchRoutes();
    _fetchGrievances();
  }

  Future<void> _fetchRoutes() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final api = ApiService(prefs);
      final response = await api.getAllRoutes();
      if (response.data['success'] == true) {
        setState(() {
          _routesList = response.data['data'] ?? [];
          _isLoadingRoutes = false;
        });
      }
    } catch (e) {
      setState(() => _isLoadingRoutes = false);
    }
  }

  Future<void> _fetchGrievances() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final api = ApiService(prefs);
      final response = await api.getGrievances();
      if (response.data['success'] == true) {
        setState(() {
          _grievancesList = response.data['data'] ?? [];
          _isLoadingGrievances = false;
        });
      }
    } catch (e) {
      setState(() => _isLoadingGrievances = false);
    }
  }

  Future<void> _fetchUsers() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final api = ApiService(prefs);
      final response = await api.getAllUsers();
      if (response.data['success'] == true) {
        setState(() {
          _usersList = response.data['data'] ?? [];
          _isLoadingUsers = false;
        });
      }
    } catch (e) {
      setState(() => _isLoadingUsers = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = Provider.of<LangProvider>(context);
    final user = Provider.of<AuthProvider>(context).user;

    final tabs = [
      _buildOverviewTab(),
      _buildUsersTab(),
      _buildRoutesTab(),
      _buildGrievancesTab(),
    ];

    return FloatingBackground(
      iconColor: AppColors.secondaryOrange,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: PreferredSize(
          preferredSize: const Size.fromHeight(65),
          child: _buildHeader(user, lang),
        ),
      body: tabs[_currentIndex],
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.1),
              blurRadius: 10,
              offset: const Offset(0, -2),
            )
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (i) => setState(() => _currentIndex = i),
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          selectedItemColor: AppColors.secondaryOrange,
          unselectedItemColor: Colors.grey.shade500,
          selectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 12),
          unselectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w500, fontSize: 11),
          items: const [
            BottomNavigationBarItem(icon: Icon(LucideIcons.layoutDashboard), label: 'Overview'),
            BottomNavigationBarItem(icon: Icon(LucideIcons.users), label: 'Users'),
            BottomNavigationBarItem(icon: Icon(LucideIcons.map), label: 'Routes'),
            BottomNavigationBarItem(icon: Icon(LucideIcons.messageSquare), label: 'Grievances'),
          ],
        ),
      ),
      floatingActionButton: _currentIndex == 0 ? FloatingActionButton(
        onPressed: () {},
        backgroundColor: AppColors.secondaryOrange,
        child: const Icon(LucideIcons.megaphone, color: Colors.white),
      ) : null,
    ));
  }

  Widget _buildHeader(UserModel? user, LangProvider lang) {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          alignment: Alignment.bottomCenter,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.9),
            border: Border(bottom: BorderSide(color: AppColors.secondaryOrange.withValues(alpha: 0.5), width: 3)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 12, top: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.secondaryOrange,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.secondaryOrange.withValues(alpha: 0.3),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            )
                          ],
                        ),
                        child: const Icon(LucideIcons.shield, color: Colors.white, size: 20),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'ADMIN PANEL',
                        style: GoogleFonts.inter(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Colors.black87,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      IconButton(
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        icon: const Icon(LucideIcons.bell, color: Colors.black87, size: 22),
                        onPressed: () {},
                      ),
                      const SizedBox(width: 12),
                      Container(
                        width: 32,
                        height: 32,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.secondaryOrange,
                        ),
                        child: Center(
                          child: Text(
                            (user?.name ?? 'A')[0].toUpperCase(),
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ),
                    ],
                  )
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOverviewTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: _buildStatCard(LucideIcons.users, 'Total Users', '1,245', Colors.blue)),
              const SizedBox(width: 12),
              Expanded(child: _buildStatCard(LucideIcons.mapPin, 'Active Routes', '12', Colors.purple)),
              const SizedBox(width: 12),
              Expanded(child: _buildStatCard(LucideIcons.alertOctagon, 'SOS Alerts', '0', Colors.red)),
            ],
          ),
          const SizedBox(height: 24),
          _buildAdminMapCard(),
        ],
      ),
    );
  }

  Widget _buildStatCard(IconData icon, String label, String value, Color iconColor) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 8, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(height: 12),
          Text(
            label,
            style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.black87),
          ),
        ],
      ),
    );
  }

  Widget _buildAdminMapCard() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.secondaryOrange.withValues(alpha: 0.2)),
        boxShadow: [BoxShadow(color: AppColors.secondaryOrange.withValues(alpha: 0.05), blurRadius: 16, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            decoration: BoxDecoration(
              color: AppColors.secondaryOrange.withValues(alpha: 0.05),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              border: Border(bottom: BorderSide(color: AppColors.secondaryOrange.withValues(alpha: 0.1))),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(LucideIcons.activity, color: AppColors.secondaryOrange, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'Live Fleet Tracking',
                      style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.secondaryOrange),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.green.shade100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'Active',
                    style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.green.shade700),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: SizedBox(
              height: 300,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: FlutterMap(
                  options: MapOptions(
                    initialCenter: const LatLng(28.3180, 79.4670),
                    initialZoom: 13.0,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.invertis.bussaarthi',
                    ),
                  ],
                ),
              ),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildUsersTab() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          color: Colors.white,
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      decoration: InputDecoration(
                        hintText: 'Search users by name or ID...',
                        hintStyle: GoogleFonts.inter(fontSize: 14, color: Colors.grey.shade400),
                        prefixIcon: Icon(LucideIcons.search, color: Colors.grey.shade400, size: 20),
                        filled: true,
                        fillColor: const Color(0xFFF4F7FB),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.secondaryOrange,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: IconButton(
                      icon: const Icon(LucideIcons.userPlus, color: Colors.white),
                      onPressed: () {},
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildFilterChip('All Users', true),
                    _buildFilterChip('Passengers', false),
                    _buildFilterChip('Parents', false),
                    _buildFilterChip('Admins', false),
                  ],
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: _isLoadingUsers 
            ? const Center(child: CircularProgressIndicator(color: AppColors.secondaryOrange))
            : _usersList.isEmpty 
              ? const Center(child: Text("No users found"))
              : ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _usersList.length,
            itemBuilder: (context, index) {
              final user = _usersList[index];
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.shade200),
                  boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))],
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: Colors.blue.shade50,
                      child: Text(
                        (user['name'] ?? 'U')[0].toUpperCase(),
                        style: const TextStyle(color: Colors.blue, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user['name'] ?? 'Unknown', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
                          Text('Pass ID: ${user['passenger_id'] ?? '-'}', style: GoogleFonts.inter(fontSize: 12, color: Colors.grey.shade500)),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.orange.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text((user['role'] ?? '').toString().toUpperCase(), style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.secondaryOrange)),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String label, bool isSelected) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: isSelected ? AppColors.secondaryOrange : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: GoogleFonts.inter(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: isSelected ? Colors.white : Colors.grey.shade600,
        ),
      ),
    );
  }

  Widget _buildRoutesTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFFFEF2F2), Color(0xFFFFF7ED)]),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.orange.shade200),
              boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: Colors.orange.withValues(alpha: 0.2), blurRadius: 8)],
                  ),
                  child: const Icon(LucideIcons.gitMerge, color: AppColors.secondaryOrange, size: 24),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Merge Routes', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.orange.shade800)),
                      const SizedBox(height: 4),
                      Text('Temporarily combine buses for optimization', style: GoogleFonts.inter(fontSize: 12, color: Colors.orange.shade600)),
                    ],
                  ),
                ),
                Icon(LucideIcons.chevronRight, color: Colors.orange.shade800),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Text('Active Routes', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.black87)),
          const SizedBox(height: 12),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _isLoadingRoutes ? 0 : (_routesList.isEmpty ? 0 : _routesList.length),
            itemBuilder: (context, index) {
              final route = _routesList[index];
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(LucideIcons.mapPin, color: AppColors.secondaryOrange, size: 18),
                            const SizedBox(width: 8),
                            Text('Route ${route['route_id'] ?? index + 1}', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700)),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(8)),
                          child: Text(route['status'] ?? 'Active', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.green.shade700)),
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Bus Number', style: GoogleFonts.inter(fontSize: 11, color: Colors.grey.shade500)),
                            Text(route['bus_number'] ?? '-', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600)),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('Driver', style: GoogleFonts.inter(fontSize: 11, color: Colors.grey.shade500)),
                            Text(route['driver_name'] ?? '-', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ],
                    )
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildGrievancesTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Recent Grievances', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.black87)),
          const SizedBox(height: 12),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _isLoadingGrievances ? 0 : _grievancesList.length,
            itemBuilder: (context, index) {
              final grievance = _grievancesList[index];
              final String title = grievance['title'] ?? 'Complaint';
              final String submittedBy = grievance['submitted_by'] ?? 'Unknown';
              final String priority = grievance['priority'] ?? 'Low';
              final String time = grievance['created_at'] != null ? 'Recent' : 'N/A';

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                          child: Text(priority, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.red)),
                        ),
                        Text(time, style: GoogleFonts.inter(fontSize: 12, color: Colors.grey.shade500)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(title, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text('Submitted by: $submittedBy', style: GoogleFonts.inter(fontSize: 13, color: Colors.grey.shade600)),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () {},
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.secondaryOrange,
                          side: const BorderSide(color: AppColors.secondaryOrange),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: const Text('Mark as Resolved'),
                      ),
                    ),
                  ],
                ),
              );
            },
          )
        ],
      ),
    );
  }
}
