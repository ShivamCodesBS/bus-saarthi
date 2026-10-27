/// Stop name → [lat, lng], ported 1:1 from the web Home.jsx `STOP_COORDS`.
class StopCoords {
  StopCoords._();

  static const Map<String, List<double>> all = {
    // Bareilly Core
    'Civil Lines': [28.3615, 79.4180],
    'Rajendra Nagar': [28.3610, 79.4501],
    'DD Puram': [28.3715, 79.4452],
    'Pilibhit Bypass': [28.3842, 79.4310],
    'Invertis University': [28.3180, 79.4670],
    'labela chowk': [28.3500, 79.4200],
    'police line': [28.3550, 79.4250],
    'Chauki Chauraha': [28.3580, 79.4120],
    'Satellite Bus Stand': [28.3440, 79.4420],
    'Bareilly Mod': [28.2500, 79.5200],
    // Shahjahanpur Hubs
    'Shahjahanpur': [27.8805, 79.9140],
    'Shahjahanpur Bus Stand': [27.8820, 79.9100],
    'Roza Junction': [27.8350, 79.9200],
    'Tilhar': [28.0200, 79.7300],
    'Miranpur Katra': [28.1100, 79.6200],
    // Badaun Hubs
    'Badaun': [28.0300, 79.1200],
    'Badaun Road': [28.2000, 79.2800],
    'Ujhani': [28.0100, 79.0100],
    'Dataganj': [27.9400, 79.3500],
    // Pilibhit & Others
    'Pilibhit': [28.6300, 79.8000],
    'Bisalpur': [28.3000, 79.8000],
    'Nawabganj': [28.5400, 79.6300],
    'Faridpur': [28.2100, 79.5400],
  };
}
