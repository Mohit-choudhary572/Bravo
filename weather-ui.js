/**
 * AFOS - Adaptive Farm Operations System
 * Weather UI Rendering Component
 * 
 * Generates clean, accessible weather cards, daily forecast grids,
 * loading indicators, error banners, and manual refresh controls.
 */

class WeatherUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  /**
   * Shows a loading skeleton while requesting Open-Meteo.
   */
  showLoading(farmName) {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="weather-card loading-state">
        <div class="spinner"></div>
        <div class="loading-text">
          <strong>Requesting Open-Meteo Weather API</strong>
          <p>Retrieving current conditions & 7-day forecast for <em>${farmName || 'selected farm'}</em>...</p>
        </div>
      </div>
    `;
  }

  /**
   * Displays friendly, actionable error messages.
   */
  showError(errorMsg, onRetry, onEditCoords) {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="weather-card error-state">
        <div class="error-icon">⚠️</div>
        <div class="error-content">
          <h4>Unable to Load Weather Forecast</h4>
          <p class="error-detail">${this.escapeHtml(errorMsg || 'An unexpected error occurred.')}</p>
          <div class="error-actions">
            ${onRetry ? `<button class="btn btn-primary btn-sm" id="btn-weather-retry">🔄 Try Again</button>` : ''}
            ${onEditCoords ? `<button class="btn btn-outline btn-sm" id="btn-weather-edit-coords">📍 Update Coordinates</button>` : ''}
          </div>
        </div>
      </div>
    `;

    if (onRetry) {
      document.getElementById('btn-weather-retry')?.addEventListener('click', onRetry);
    }
    if (onEditCoords) {
      document.getElementById('btn-weather-edit-coords')?.addEventListener('click', onEditCoords);
    }
  }

  /**
   * Renders the complete weather section.
   * 
   * @param {object} weather - Normalized data from WeatherService
   * @param {object} farm - Farm record
   * @param {boolean} fromCache - Was data served from client-side cache
   * @param {Function} onRefresh - Handler for manual refresh button
   * @param {Function} onEditCoords - Handler for updating farm coordinates
   */
  renderWeather(weather, farm, fromCache, onRefresh, onEditCoords) {
    if (!this.container || !weather) return;

    const current = weather.current || {};
    const daily = weather.daily || [];
    const formattedTime = weather.fetchedAt
      ? new Date(weather.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : 'Just now';

    const precipProb = daily[0]?.precipProbabilityMax ?? 0;
    const precipSum = daily[0]?.precipSum ?? 0;

    this.container.innerHTML = `
      <div class="weather-dashboard-card">
        <!-- Header Bar -->
        <div class="weather-header">
          <div class="weather-title-group">
            <div class="weather-badge-row">
              <span class="badge badge-success">Open-Meteo Live</span>
              <span class="badge badge-neutral">Timezone: ${weather.timezone} (${weather.timezoneAbbreviation || 'Local'})</span>
              ${fromCache ? '<span class="badge badge-cache" title="Served from 15-minute client cache to reduce network requests">⚡ Cached</span>' : '<span class="badge badge-fresh">Fresh</span>'}
            </div>
            <h3 class="farm-weather-title">${this.escapeHtml(farm.name)} Weather</h3>
            <p class="weather-meta">
              📍 <strong>${this.escapeHtml(farm.locationName || 'Farm Location')}</strong> 
              (Lat: ${Number(farm.latitude).toFixed(4)}°, Lon: ${Number(farm.longitude).toFixed(4)}°)
              ${weather.elevation !== null ? ` • Elev: ${weather.elevation}m` : ''}
              • Updated: ${formattedTime}
            </p>
          </div>
          <div class="weather-controls">
            <button class="btn btn-secondary btn-sm" id="btn-refresh-weather" title="Fetch fresh forecast from Open-Meteo">
              🔄 Refresh
            </button>
            <button class="btn btn-outline btn-sm" id="btn-edit-farm-coords" title="Edit farm latitude and longitude">
              ✏️ Edit Coords
            </button>
          </div>
        </div>

        <!-- Current Conditions 4-Grid -->
        <div class="current-weather-grid">
          <div class="metric-card metric-temp">
            <div class="metric-icon">🌡️</div>
            <div class="metric-info">
              <span class="metric-label">Current Temperature</span>
              <span class="metric-value">${current.temperature !== undefined ? current.temperature : '--'}<span class="unit">${current.temperatureUnit || '°C'}</span></span>
              <span class="metric-sub">Today's Range: ${daily[0]?.tempMin ?? '--'}° to ${daily[0]?.tempMax ?? '--'}°</span>
            </div>
          </div>

          <div class="metric-card metric-humidity">
            <div class="metric-icon">💧</div>
            <div class="metric-info">
              <span class="metric-label">Relative Humidity</span>
              <span class="metric-value">${current.relativeHumidity !== undefined ? current.relativeHumidity : '--'}<span class="unit">${current.humidityUnit || '%'}</span></span>
              <span class="metric-sub">${this.getHumidityLabel(current.relativeHumidity)}</span>
            </div>
          </div>

          <div class="metric-card metric-precip">
            <div class="metric-icon">🌧️</div>
            <div class="metric-info">
              <span class="metric-label">Current Precipitation</span>
              <span class="metric-value">${current.precipitation !== undefined ? current.precipitation : '--'}<span class="unit">${current.precipitationUnit || 'mm'}</span></span>
              <span class="metric-sub">Today Total: ~${precipSum} ${daily[0]?.precipSumUnit || 'mm'} (${precipProb}% chance)</span>
            </div>
          </div>

          <div class="metric-card metric-wind">
            <div class="metric-icon">💨</div>
            <div class="metric-info">
              <span class="metric-label">Wind Speed</span>
              <span class="metric-value">${current.windSpeed !== undefined ? current.windSpeed : '--'}<span class="unit">${current.windSpeedUnit || 'km/h'}</span></span>
              <span class="metric-sub">${this.getWindLabel(current.windSpeed)}</span>
            </div>
          </div>
        </div>

        <!-- 7-Day Daily Forecast Section -->
        <div class="forecast-section">
          <div class="forecast-section-header">
            <h4>7-Day Agricultural Forecast</h4>
            <span class="forecast-sub">Includes daily precipitation probability, total rainfall, and max/min temperature</span>
          </div>

          <div class="daily-forecast-grid">
            ${daily.map((day, idx) => this.renderDailyCard(day, idx === 0)).join('')}
          </div>
        </div>
      </div>
    `;

    // Bind event listeners
    document.getElementById('btn-refresh-weather')?.addEventListener('click', () => {
      if (onRefresh) onRefresh();
    });
    document.getElementById('btn-edit-farm-coords')?.addEventListener('click', () => {
      if (onEditCoords) onEditCoords();
    });
  }

  /**
   * Helper to render an individual day card in the 7-day forecast.
   */
  renderDailyCard(day, isToday) {
    const prob = day.precipProbabilityMax ?? 0;
    const rainSum = day.precipSum ?? 0;
    const isHighRain = prob >= 50 || rainSum >= 5;
    const isModerateRain = (prob >= 30 && prob < 50) || (rainSum >= 1.5 && rainSum < 5);

    let rainTagClass = 'rain-low';
    let rainStatusText = 'Dry / Low Risk';
    if (isHighRain) {
      rainTagClass = 'rain-high';
      rainStatusText = 'High Rain Chance';
    } else if (isModerateRain) {
      rainTagClass = 'rain-med';
      rainStatusText = 'Moderate Chance';
    }

    return `
      <div class="daily-card ${isToday ? 'daily-today' : ''}">
        <div class="daily-date">
          <span class="day-name">${isToday ? 'Today' : day.weekday.split(',')[0]}</span>
          <span class="calendar-date">${day.date.slice(5)}</span>
        </div>

        <div class="daily-temps">
          <span class="temp-high" title="Maximum Daily Temperature">${day.tempMax ?? '--'}${day.tempMaxUnit}</span>
          <span class="temp-separator">/</span>
          <span class="temp-low" title="Minimum Daily Temperature">${day.tempMin ?? '--'}${day.tempMinUnit}</span>
        </div>

        <div class="daily-precip-box">
          <div class="precip-prob-row">
            <span class="precip-icon">🌧️</span>
            <span class="precip-percent">${prob}${day.precipProbabilityUnit}</span>
          </div>
          <div class="precip-bar-wrapper">
            <div class="precip-bar ${rainTagClass}" style="width: ${Math.min(100, Math.max(8, prob))}%"></div>
          </div>
          <div class="precip-sum-label">
            ${rainSum > 0 ? `${rainSum} ${day.precipSumUnit}` : '0 mm'}
          </div>
        </div>

        <div class="daily-status-tag ${rainTagClass}">
          ${rainStatusText}
        </div>
      </div>
    `;
  }

  getHumidityLabel(rh) {
    if (rh === undefined || rh === null) return 'Normal';
    if (rh < 30) return 'Low humidity (Dry air)';
    if (rh <= 65) return 'Optimal crop humidity';
    if (rh <= 80) return 'Elevated humidity';
    return 'High humidity (Fungal watch)';
  }

  getWindLabel(ws) {
    if (ws === undefined || ws === null) return 'Gentle';
    if (ws < 10) return 'Calm (Ideal for spraying)';
    if (ws <= 20) return 'Moderate breeze';
    if (ws <= 30) return 'Strong breeze (Spraying drift)';
    return 'High winds (Hazardous)';
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// Global weather UI instance
window.WeatherUI = WeatherUI;
