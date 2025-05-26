import { map as createMap, tileLayer, Icon, marker, popup, icon, latLng, control, layerGroup } from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

export default class Map {
  #zoom = 5;
  #map = null;
  #baseLayers = {};
  #overlays = {};
  #layerControl = null;
  
  // MapTiler API key
  #mapTilerKey = 'DgAqexwFefbHfJBEtOke';

  static isGeolocationAvailable() {
    return "geolocation" in navigator;
  }

  static getCurrentPosition(options = {}) {
    return new Promise((resolve, reject) => {
      if (!Map.isGeolocationAvailable()) {
        reject("Geolocation API unsupported");
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
  }

  static async build(selector, options = {}) {
    if ("center" in options && options.center) {
      return new Map(selector, options);
    }

    const jakartaCoordinate = [-6.2, 106.816666];

    if ("locate" in options && options.locate) {
      try {
        const position = await Map.getCurrentPosition();
        const coordinate = [
          position.coords.latitude,
          position.coords.longitude,
        ];

        return new Map(selector, {
          ...options,
          center: coordinate,
        });
      } catch (error) {
        console.error("build: error", error);

        return new Map(selector, {
          ...options,
          center: jakartaCoordinate,
        });
      }
    }

    return new Map(selector, {
      ...options,
      center: jakartaCoordinate,
    });
  }

  constructor(selector, options = {}) {
    this.#zoom = options.zoom ?? this.#zoom;
    
    // Jika API key disediakan dalam options, gunakan itu
    if (options.mapTilerKey) {
      this.#mapTilerKey = options.mapTilerKey;
    }

    // Fallback ke OpenStreetMap jika tidak ada API key
    const osmLayer = tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    });
    
    // Inisialisasi layer menggunakan MapTiler
    const streetsLayer = this.#createMapTilerLayer('streets');
    const satelliteLayer = this.#createMapTilerLayer('satellite');
    const hybridLayer = this.#createMapTilerLayer('hybrid');
    const basicLayer = this.#createMapTilerLayer('basic');
    const tonerLayer = this.#createMapTilerLayer('toner');
    const darkLayer = this.#createMapTilerLayer('dark');
    
    // Tentukan layer mana yang akan digunakan berdasarkan ketersediaan API key
    const defaultLayer = this.#mapTilerKey ? streetsLayer : osmLayer;
    
    // Simpan base layers untuk layer control
    this.#baseLayers = {
      "Streets": streetsLayer,
      "Satelit": satelliteLayer,
      "Hybrid": hybridLayer,
      "Basic": basicLayer,
      "Toner": tonerLayer,
      "Mode Gelap": darkLayer
    };
    
    if (!this.#mapTilerKey) {
      // Jika tidak ada API key, hanya tampilkan OpenStreetMap
      this.#baseLayers = {
        "OpenStreetMap": osmLayer
      };
    }
    
    // Initialize map dengan layer default
    this.#map = createMap(document.querySelector(selector), {
        zoom: this.#zoom,
        scrollWheelZoom: true,
        layers: [defaultLayer], 
        ...options,
    });
    
    // Tambahkan layer control
    this.#layerControl = control.layers(this.#baseLayers, this.#overlays).addTo(this.#map);
  }
  
  // Metode untuk membuat layer MapTiler
  #createMapTilerLayer(style) {
    // Penanganan khusus untuk satellite dan hybrid
    if (style === 'satellite') {
      return tileLayer(`https://api.maptiler.com/tiles/satellite/{z}/{x}/{y}.jpg?key=${this.#mapTilerKey}`, {
        tileSize: 512,
        zoomOffset: -1,
        minZoom: 1,
        attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a>',
        crossOrigin: true
      });
    }
    
    if (style === 'hybrid') {
      // Membuat group layer untuk hybrid (satellite + labels)
      const satelliteLayer = tileLayer(`https://api.maptiler.com/tiles/satellite/{z}/{x}/{y}.jpg?key=${this.#mapTilerKey}`, {
        tileSize: 512,
        zoomOffset: -1,
        minZoom: 1
      });
      
      const labelsLayer = tileLayer(`https://api.maptiler.com/maps/streets-v2/overlay/{z}/{x}/{y}.png?key=${this.#mapTilerKey}`, {
        tileSize: 512,
        zoomOffset: -1,
        minZoom: 1,
        attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
      });
      
      // Membuat group layer dengan Leaflet
      const hybridLayerGroup = layerGroup([satelliteLayer, labelsLayer]);
      return hybridLayerGroup;
    }
    
    // Mapping style untuk style lainnya
    const styleMap = {
      'streets': 'streets-v2',
      'basic': 'basic-v2',
      'toner': 'toner-v2',
      'dark': 'dark-v2'
    };
    
    const actualStyle = styleMap[style] || style;
    
    return tileLayer(`https://api.maptiler.com/maps/${actualStyle}/{z}/{x}/{y}.png?key=${this.#mapTilerKey}`, {
      tileSize: 512,
      zoomOffset: -1,
      minZoom: 1,
      attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
      crossOrigin: true
    });
  }

  changeCamera(coordinate, zoomLevel = null) {
    if (!zoomLevel) {
        this.#map.setView(latLng(coordinate), this.#zoom);
        return;
    }

    this.#map.setView(latLng(coordinate), zoomLevel);
  }

  getCenter() {
    const { lat, lng } = this.#map.getCenter();
    return {
        latitude: lat,
        longitude: lng,
    };
  }

  createIcon(options = {}) {
    return icon({
        ...Icon.Default.prototype.options,
        iconRetinaUrl: markerIcon2x,
        iconUrl: markerIcon,
        shadowUrl: markerShadow,
        ...options,
    });
  }

  addMarker(coordinates, markerOptions = {}, popupOptions = null) {
    if (typeof markerOptions !== 'object') {
        throw new Error('markerOptions must be an object');
    }

    const newMarker = marker(coordinates, {
        icon: this.createIcon(),
        ...markerOptions,
    });

    if (popupOptions) {
        if (typeof popupOptions !== 'object') {
            throw new Error('popupOptions must be an object');
        }

        if (!('content' in popupOptions)) {
            throw new Error('popupOptions must include `content` property');
        }

        const newPopup = popup({
            content: popupOptions.content
        });
        newMarker.bindPopup(newPopup);
    }

    newMarker.addTo(this.#map);

    return newMarker;
  }

  // Metode untuk menambahkan overlay layer
  addOverlayLayer(name, layer) {
    this.#overlays[name] = layer;
    this.#layerControl.addOverlay(layer, name);
    return layer;
  }

  // Metode untuk menghapus overlay layer
  removeOverlayLayer(name) {
    if (this.#overlays[name]) {
      this.#map.removeLayer(this.#overlays[name]);
      delete this.#overlays[name];
      this.#layerControl.remove();
      this.#layerControl = control.layers(this.#baseLayers, this.#overlays).addTo(this.#map);
    }
  }

  addMapEventListener(eventName, callback) {
    this.#map.on(eventName, callback);
  }
}