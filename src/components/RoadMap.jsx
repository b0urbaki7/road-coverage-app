import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Search } from 'lucide-react';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

if (!import.meta.env.VITE_MAPBOX_TOKEN) {
  throw new Error('Mapbox token is required in .env file');
}

const CitySearch = ({ onCitySelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchCity = async (query) => {
    if (!query) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` + 
        `access_token=${mapboxgl.accessToken}&types=place&limit=5`
      );
      const data = await response.json();
      
      const cities = data.features.map(feature => ({
        name: feature.text,
        fullName: feature.place_name,
        coordinates: feature.center,
        bbox: feature.bbox
      }));
      
      setSuggestions(cities);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
    setLoading(false);
  };

  // Debounce search to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCity(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleCitySelect = (city) => {
    setSearchTerm(city.fullName);
    setSuggestions([]);
    onCitySelect(city);
  };

  return (
    <div className="absolute top-4 left-4 z-10 w-72">
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for a city..."
            className="w-full px-4 py-2 pl-10 bg-white border rounded-lg shadow-md"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
        
        {suggestions.length > 0 && (
          <div className="absolute w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((city, index) => (
              <button
                key={index}
                onClick={() => handleCitySelect(city)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                {city.fullName}
              </button>
            ))}
          </div>
        )}
        
        {loading && (
          <div className="absolute right-3 top-2.5">
            <div className="w-5 h-5 border-t-2 border-blue-500 rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
};

const calculateCoverage = (roadData, bounds) => {
    const roadWidths = {
      'motorway': 12,
      'trunk': 10,
      'primary': 8,
      'secondary': 6,
      'tertiary': 5,
      'residential': 4,
      'service': 2.5,
      'unclassified': 4,
      'default': 4
    };
  
    // Calculate bounding box area in km²
    const dLng = (bounds.ne.lng - bounds.sw.lng);
    const dLat = (bounds.ne.lat - bounds.sw.lat);
    const avgLat = ((bounds.ne.lat + bounds.sw.lat) / 2);
    
    const totalArea = Math.abs(111.32 * 111.32 * Math.cos(avgLat * (Math.PI / 180)) * dLng * dLat);
  
    // Build node lookup and filter nodes within viewport
    const nodeLookup = new Map();
    roadData.elements.forEach(element => {
      if (element.type === 'node') {
        // Only include nodes within viewport bounds
        if (element.lon >= bounds.sw.lng && element.lon <= bounds.ne.lng &&
            element.lat >= bounds.sw.lat && element.lat <= bounds.ne.lat) {
          nodeLookup.set(element.id, [element.lon, element.lat]);
        }
      }
    });
  
    let totalRoadArea = 0;
    const processedSegments = new Set();
  
    roadData.elements.forEach(element => {
      if (element.type === 'way' && element.tags?.highway) {
        const roadType = element.tags.highway;
        const width = roadWidths[roadType] || roadWidths.default;
        
        const nodes = element.nodes;
        for (let i = 0; i < nodes.length - 1; i++) {
          const coord1 = nodeLookup.get(nodes[i]);
          const coord2 = nodeLookup.get(nodes[i + 1]);
          
          // Skip if either node is outside viewport
          if (!coord1 || !coord2) continue;
  
          const segmentId = [nodes[i], nodes[i + 1]].sort().join('-');
          if (processedSegments.has(segmentId)) continue;
          processedSegments.add(segmentId);
  
          const [lon1, lat1] = coord1;
          const [lon2, lat2] = coord2;
          
          const dx = (lon2 - lon1) * Math.cos(avgLat * (Math.PI / 180)) * 111.32;
          const dy = (lat2 - lat1) * 111.32;
          const length = Math.sqrt(dx * dx + dy * dy);
          
          const segmentArea = length * (width / 1000);
          totalRoadArea += segmentArea;
        }
      }
    });
  
    console.log('Viewport Area (km²):', totalArea.toFixed(4));
    console.log('Road Area (km²):', totalRoadArea.toFixed(4));
    console.log('Processed segments:', processedSegments.size);
    
    const coverage = (totalRoadArea / totalArea) * 100;
    return coverage.toFixed(2);
  };

export default function RoadMap() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [loading, setLoading] = useState(true);
  const [coverage, setCoverage] = useState(null);
  const [viewportArea, setViewportArea] = useState(null);

  const handleCitySelect = (city) => {
    if (!map.current) return;

    if (city.bbox) {
      map.current.fitBounds(
        [
          [city.bbox[0], city.bbox[1]], // southwestern corner
          [city.bbox[2], city.bbox[3]]  // northeastern corner
        ],
        { padding: 50 }
      );
    } else {
      map.current.flyTo({
        center: city.coordinates,
        zoom: 12
      });
    }
  };

  const calculateViewportCoverage = async () => {
    if (!map.current) return;
    
    setLoading(true);
    const bounds = {
      sw: { 
        lng: map.current.getBounds().getWest(), 
        lat: map.current.getBounds().getSouth() 
      },
      ne: { 
        lng: map.current.getBounds().getEast(), 
        lat: map.current.getBounds().getNorth() 
      }
    };

    const query = `
      [out:json][timeout:25];
      (
        way["highway"](${bounds.sw.lat},${bounds.sw.lng},${bounds.ne.lat},${bounds.ne.lng});
      );
      out body;
      >;
      out skel qt;
    `;
    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query
        });
        const data = await response.json();
        
        const coveragePercent = calculateCoverage(data, bounds);
        setCoverage(coveragePercent);
        
        // Calculate viewport area in km²
        const dLng = (bounds.ne.lng - bounds.sw.lng);
        const dLat = (bounds.ne.lat - bounds.sw.lat);
        const avgLat = ((bounds.ne.lat + bounds.sw.lat) / 2);
        const area = Math.abs(111.32 * 111.32 * Math.cos(avgLat * (Math.PI / 180)) * dLng * dLat);
        setViewportArea(area.toFixed(2));
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching road data:', error);
        setLoading(false);
      }
    };

  useEffect(() => {
    if (map.current) return;
        
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-122.674194, 45.5202471],
      zoom: 12
    });

    map.current.on('load', calculateViewportCoverage);
  }, []);

  return (
    <div>
      <div ref={mapContainer} className="map-container" />
      <CitySearch onCitySelect={handleCitySelect} />
      <div className="p-4">
      <button
          onClick={calculateViewportCoverage}
          disabled={loading}
          className="mb-3 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center w-full"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-t-2 border-white rounded-full animate-spin mr-2" />
              Calculating...
            </>
          ) : (
            'Calculate Coverage'
          )}
        </button>
        {coverage !== null && (
          <>
            <div>Road coverage: {coverage}% of viewport area</div>
            <div className="text-sm text-gray-600">
              Viewport area: {viewportArea} km²
            </div>
          </>
        )}
      </div>
    </div>
  );
}