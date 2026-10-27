/**
 * AFOS - Adaptive Farm Operations System
 * Weather Service Module
 * 
 * Integrates the Open-Meteo Weather Forecast API (free, open-source, no API key required).
 * Uses fetch() and URLSearchParams with farm-local timezone ('auto').
 */

class WeatherService {
  constructor() {
    this.baseUrl = 'https://api.open-meteo.com/v1/forecast';
    this.cachePrefix = 'afos_weather_cache_';
    this.cacheDurationMs = 15 * 60 * 1000; // 15-minute client-side caching to keep requests efficient
    this.inMemoryCache = new Map();
  }

  /**
   * Validates latitude and longitude coordinates.
   * @param {number|string} lat 
   * @param {number|string} lon 
   * @returns {{ valid: boolean, error?: string, lat?: number, lon?: number }}
   */
  validateCoordinates(lat, lon) {
    if (lat === null || lat === undefined || lat === '' || lon === null || lon === undefined || lon === '') {
      return { valid: false, error: 'Coordinates missing. Please set farm latitude and longitude.' };
    }

    const nLat = parseFloat(lat);
    const nLon = parseFloat(lon);

    if (isNaN(nLat) || isNaN(nLon)) {
      return { valid: false, error: 'Coordinates must be valid numbers.' };
    }

    if (nLat < -90 || nLat > 90) {
      return { valid: false, error: `Latitude (${nLat}) is out of range. Must be between -90 and 90.` };
    }

    if (nLon < -180 || nLon > 180) {
      return { valid: false, error: `Longitude (${nLon}) is out of range. Must be between -180 and 180.` };
    }

    return { valid: true, lat: nLat, lon: nLon };
  }

  /**
   * Generates a cache key based on coordinates (rounded to 4 decimals ~11 meters).
   */
  getCacheKey(lat, lon) {
    return `${this.cachePrefix}${lat.toFixed(4)}_${lon.toFixed(4)}`;
  }

  /**
   * Checks for cached data in memory or sessionStorage.
   */
  getCachedWeather(lat, lon) {
    const key = this.getCacheKey(lat, lon);
    const now = Date.now();

    // Check memory first
    if (this.inMemoryCache.has(key)) {
      const entry = this.inMemoryCache.get(key);
      if (now - entry.timestamp < this.cacheDurationMs) {
        return entry.data;
      }
      this.inMemoryCache.delete(key);
    }

    // Check sessionStorage
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (now - parsed.timestamp < this.cacheDurationMs) {
          this.inMemoryCache.set(key, parsed);
          return parsed.data;
        }
        sessionStorage.removeItem(key);
      }
    } catch (e) {
      // sessionStorage unavailable or storage quota exceeded, proceed gracefully
    }

    return null;
  }

  /**
   * Stores fetched weather in memory and sessionStorage.
   */
  setCachedWeather(lat, lon, data) {
    const key = this.getCacheKey(lat, lon);
    const entry = { timestamp: Date.now(), data };

    this.inMemoryCache.set(key, entry);
    try {
      sessionStorage.setItem(key, JSON.stringify(entry));
    } catch (e) {
      // Ignore sessionStorage errors
    }
  }

  /**
   * Clears cache for specific coordinates or all cached items.
   */
  clearCache(lat = null, lon = null) {
    if (lat !== null && lon !== null) {
      const key = this.getCacheKey(lat, lon);
      this.inMemoryCache.delete(key);
      try {
        sessionStorage.removeItem(key);
      } catch (e) {}
    } else {
      this.inMemoryCache.clear();
      try {
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith(this.cachePrefix)) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {}
    }
  }

  /**
   * Fetches weather forecast data from Open-Meteo using fetch() & URLSearchParams.
   * 
   * @param {number|string} latitude 
   * @param {number|string} longitude 
   * @param {boolean} forceRefresh - If true, bypasses cache
   * @returns {Promise<{ success: boolean, data?: object, error?: string, fromCache?: boolean }>}
   */
  async fetchForecast(latitude, longitude, forceRefresh = false) {
    const validation = this.validateCoordinates(latitude, longitude);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const { lat, lon } = validation;

    // Check cache unless explicitly requested to refresh
    if (!forceRefresh) {
      const cached = this.getCachedWeather(lat, lon);
      if (cached) {
        return { success: true, data: cached, fromCache: true };
      }
    }

    try {
      // Use URLSearchParams as required
      const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        current: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m',
        daily: 'precipitation_probability_max,precipitation_sum,temperature_2m_max,temperature_2m_min',
        timezone: 'auto'
      });

      const url = `${this.baseUrl}?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson && errJson.reason) {
            errorDetail = errJson.reason;
          }
        } catch (_) {}
        return { success: false, error: `Weather service error: ${errorDetail}` };
      }

      const rawData = await response.json();

      // Gracefully handle missing expected blocks
      if (!rawData.current || !rawData.daily) {
        return {
          success: false,
          error: 'Weather service returned incomplete forecast data for this location.'
        };
      }

      // Structure normalized response with exact API units
      const currentUnits = rawData.current_units || {};
      const dailyUnits = rawData.daily_units || {};

      const current = {
        time: rawData.current.time,
        temperature: rawData.current.temperature_2m,
        temperatureUnit: currentUnits.temperature_2m || '°C',
        relativeHumidity: rawData.current.relative_humidity_2m,
        humidityUnit: currentUnits.relative_humidity_2m || '%',
        precipitation: rawData.current.precipitation,
        precipitationUnit: currentUnits.precipitation || 'mm',
        windSpeed: rawData.current.wind_speed_10m,
        windSpeedUnit: currentUnits.wind_speed_10m || 'km/h'
      };

      // Process daily forecast list
      const dailyTimes = rawData.daily.time || [];
      const dailyList = dailyTimes.map((dateStr, index) => {
        const prob = rawData.daily.precipitation_probability_max?.[index] ?? null;
        const sum = rawData.daily.precipitation_sum?.[index] ?? null;
        const max = rawData.daily.temperature_2m_max?.[index] ?? null;
        const min = rawData.daily.temperature_2m_min?.[index] ?? null;

        // Date presentation helper
        const dateObj = new Date(`${dateStr}T00:00:00`);
        const weekday = isNaN(dateObj.getTime())
          ? dateStr
          : dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

        return {
          date: dateStr,
          weekday,
          precipProbabilityMax: prob,
          precipProbabilityUnit: dailyUnits.precipitation_probability_max || '%',
          precipSum: sum,
          precipSumUnit: dailyUnits.precipitation_sum || 'mm',
          tempMax: max,
          tempMaxUnit: dailyUnits.temperature_2m_max || '°C',
          tempMin: min,
          tempMinUnit: dailyUnits.temperature_2m_min || '°C'
        };
      });

      const structuredData = {
        coordinates: {
          latitude: rawData.latitude ?? lat,
          longitude: rawData.longitude ?? lon
        },
        timezone: rawData.timezone || 'auto',
        timezoneAbbreviation: rawData.timezone_abbreviation || '',
        elevation: rawData.elevation ?? null,
        current,
        daily: dailyList,
        fetchedAt: new Date().toISOString()
      };

      // Cache successfully retrieved payload
      this.setCachedWeather(lat, lon, structuredData);

      return {
        success: true,
        data: structuredData,
        fromCache: false
      };
    } catch (err) {
      const isOffline = !navigator.onLine;
      const msg = isOffline
        ? 'Network offline. Please check your internet connection.'
        : `Weather request failed: ${err.message || 'Unable to contact Open-Meteo API'}`;
      return { success: false, error: msg };
    }
  }
}

// Export singleton instance for app-wide use
window.weatherService = new WeatherService();
