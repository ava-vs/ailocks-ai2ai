import { useState, useEffect } from 'react';

interface UserLocation {
  country: string;
  city: string;
  timezone: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
}

export function useLocation() {
  const [location, setLocation] = useState<UserLocation>({
    country: 'BR',
    city: 'Rio de Janeiro',
    timezone: 'America/Sao_Paulo',
    isDefault: true
  });

  useEffect(() => {
    const detectLocation = async () => {
      try {
        // Try to get location from edge function headers
        const response = await fetch('/api/geo-detect', {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const geoData = await response.json();
          setLocation({
            country: geoData.country || 'BR',
            city: geoData.city || 'Rio de Janeiro',
            timezone: geoData.timezone || 'America/Sao_Paulo',
            region: geoData.region,
            latitude: geoData.latitude,
            longitude: geoData.longitude,
            isDefault: geoData.isDefault !== false
          });
        } else {
          // Fallback: try to detect from browser
          await detectFromBrowser();
        }
      } catch (error) {
        console.log('Using default location (BR):', error);
        await detectFromBrowser();
      }
    };

    const detectFromBrowser = async () => {
      try {
        // Try browser geolocation as fallback
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                // Use a free geocoding service to get city/country from coordinates
                const response = await fetch(
                  `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`
                );
                
                if (response.ok) {
                  const data = await response.json();
                  setLocation({
                    country: data.countryCode || 'BR',
                    city: data.city || data.locality || 'Rio de Janeiro',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    isDefault: false
                  });
                }
              } catch (geocodeError) {
                console.log('Geocoding failed, using default location');
              }
            },
            (error) => {
              console.log('Geolocation failed:', error.message);
            },
            { timeout: 10000, enableHighAccuracy: false }
          );
        }
      } catch (error) {
        console.log('Browser geolocation not available');
      }
    };

    detectLocation();
  }, []);

  return location;
}