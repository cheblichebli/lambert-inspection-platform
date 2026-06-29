// MEPF System Hierarchy — source of truth for RFI cascading dropdowns.
// Structure: Type → Main MEPF System → Sub-System Group → [Specific Components]
// Encoded from Said Sahloul's breakdown (email 25 June 2026).

export const MEPF = {
  Mechanical: {
    'HVAC': {
      'Central Chilled Water': ['Chillers', 'Cooling Towers', 'Pumps', 'Expansion Tanks', 'Chemical Dosing', 'Chilled Water Piping'],
      'DX & VRF Systems': ['Outdoor Condensing Units', 'Indoor Units (Cassette)', 'Indoor Units (Split)', 'Refrigerant Copper Piping'],
      'Air Handling & Distribution': ['AHUs', 'FAHUs', 'FCUs', 'VAV/CAV Boxes'],
      'Ductwork & Terminals': ['GI Ducts', 'PI Ducts', 'Fabric Ducts', 'Fire Dampers', 'VCDs', 'Diffusers', 'Grilles', 'Linear Slots'],
      'Ventilation & Extract': ['Jet Fans', 'Smoke Extract', 'Staircase Pressurization', 'Toilet/Kitchen Exhaust'],
    },
    'Fire Fighting': {
      'Water-Based Suppression': ['Fire Pumps', 'Wet Risers', 'Dry Risers', 'Sprinkler Networks', 'Hose Reels', 'Landing Valves'],
      'Gas Suppression': ['FM200', 'Novec 1230', 'CO2 Systems (Server Rooms)', 'CO2 Systems (Electrical Substations)'],
      'Foam Suppression': ['Foam Bladder Tanks', 'Proportioners (Fuel Storage)', 'Proportioners (High-Hazard Zones)'],
      'Portable Protection': ['Portable CO2 Extinguishers', 'Portable DCP Extinguishers', 'Portable Water Extinguishers', 'Fire Blankets'],
    },
    'Plumbing': {
      'Water Supply & Treatment': ['Booster Pumps', 'Filtration/Treatment Plants', 'Hot Water Networks (PPR/PEX)', 'Cold Water Networks (PPR/PEX)'],
      'Drainage Systems': ['Soil Piping', 'Waste Piping', 'Vent Piping (PVC/HDPE/Cast Iron)', 'Grease Separators', 'Oil Separators'],
      'Stormwater System': ['Roof Gullies', 'Rainwater Downpipes', 'Attenuation Tanks', 'Lifting Pumps'],
      'Sanitary Fixtures': ['Mixers', 'Water Closets', 'Lavatories', 'Specialized Medical/Lab Fixtures'],
    },
    'BMS': {
      'Central Control': ['Central Management Station (CMS)', 'Servers', 'Software', 'Workstations'],
      'Digital Control Layer': ['DDC Panels', 'Field Controllers', 'Network Gateways', 'Routers'],
      'Field Instrumentation': ['Temperature Sensors', 'Humidity Sensors', 'Pressure Sensors', 'CO2 Sensors', 'Flow Meters', 'Water Leak Detection'],
      'Actuators & Interfaces': ['Motorized Control Valves', 'Damper Actuators', 'VFD Integration'],
    },
  },
  Electrical: {
    'Power': {
      'HV / MV Distribution': ['MV Switchgear', 'Transformers', 'Ring Main Units (RMU)', 'HV/MV Cabling'],
      'LV Power Distribution': ['Main Panels (MLVDB)', 'Sub-Panels (SMDB)', 'Final DBs', 'Motor Control Centers (MCC)'],
      'Containment': ['Cable Trays', 'Ladders', 'Trunking', 'GI Conduits', 'PVC Conduits'],
      'Emergency & Backup': ['Diesel Generators', 'Fuel Systems', 'ATS Panels', 'Central UPS Systems'],
      'Earthing & Lightning': ['Earth Pits', 'Copper Tape Networks', 'Equipotential Bonding', 'Air Terminals'],
    },
    'Lighting': {
      'General & Architectural': ['Indoor Fixtures', 'Outdoor Facade Lighting', 'Landscape Illumination'],
      'Emergency & Exit': ['Central Battery Systems (CBS)', 'Self-Contained Emergency Lights', 'Exit Signs'],
      'Lighting Control (LCS)': ['Occupancy Sensors', 'Photocells', 'Dimming Modules', 'DALI/KNX Panels'],
    },
    'ELV': {
      'Fire Alarm & Voice Evac': ['FACP', 'Smoke Detectors', 'Heat Detectors', 'Call Points', 'Sounders', 'Interface Modules', 'VA Racks'],
      'Structured Cabling / ICT': ['MDF/IDF Racks', 'Fiber Backbone', 'Cat6A/7 Cabling', 'Patch Panels', 'Data Outlets'],
      'Public Address (PA/BGM)': ['Amplifiers', 'Matrix Mixers', 'Microphones', 'Ceiling/Wall Speakers'],
      'MATV / IPTV': ['Satellite Dishes', 'Headend Equipment', 'Amplifiers', 'Splitters', 'TV Outlets'],
    },
    'Access Control & Security': {
      'Physical Access Control': ['Control Panels', 'Card/Biometric Readers', 'Maglocks', 'Exit Buttons', 'Turnstiles'],
      'CCTV / Video Surveillance': ['IP Cameras (Dome)', 'IP Cameras (Bullet)', 'IP Cameras (PTZ)', 'NVRs', 'Storage Servers', 'VMS Software'],
      'Intrusion Detection (IDS)': ['Motion Sensors (PIR)', 'Glass Break Detectors', 'Magnetic Contacts', 'Alarm Panels'],
      'Intercom System': ['Audio/Video Door Entry', 'Guard Stations', 'Indoor Monitor Units'],
    },
  },
};

// Helper accessors for the cascading dropdowns
export const getMainSystems = (type) => type && MEPF[type] ? Object.keys(MEPF[type]) : [];
export const getSubSystems = (type, mainSystem) =>
  type && mainSystem && MEPF[type]?.[mainSystem] ? Object.keys(MEPF[type][mainSystem]) : [];
export const getComponents = (type, mainSystem, subSystem) =>
  type && mainSystem && subSystem && MEPF[type]?.[mainSystem]?.[subSystem] ? MEPF[type][mainSystem][subSystem] : [];
