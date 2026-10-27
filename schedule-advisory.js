/**
 * AFOS - Adaptive Farm Operations System
 * Schedule Weather Advisory Module
 * 
 * Analyzes scheduled farm operations against Open-Meteo forecasts.
 * Provides transparent, non-intrusive advisories for farmer review.
 * 
 * IMPORTANT:
 * - Advisories do NOT claim forecasts guarantee rain or conditions.
 * - AFOS NEVER automatically executes farm operations or changes schedules without farmer approval.
 */

class ScheduleAdvisoryEngine {
  constructor() {
    // Task categories sensitive to weather conditions
    this.weatherSensitiveTypes = {
      'fertilizer': {
        rainRisk: 'high',
        windRisk: 'high',
        rainMessage: 'High risk of fertilizer wash-off and nutrient leaching into runoff.',
        windMessage: 'Wind drift may cause uneven fertilizer coverage.'
      },
      'spray_pesticide': {
        rainRisk: 'high',
        windRisk: 'high',
        rainMessage: 'Rain can wash off active ingredients within 24-48 hours of application.',
        windMessage: 'Wind speeds above 15-20 km/h cause significant pesticide spray drift.'
      },
      'harvesting': {
        rainRisk: 'high',
        windRisk: 'medium',
        rainMessage: 'Rain during harvesting increases moisture content, fungal risk, and machine soil compaction.',
        windMessage: 'High winds can complicate harvesting operations.'
      },
      'irrigation': {
        rainRisk: 'medium',
        windRisk: 'low',
        rainMessage: 'Natural rainfall may supply soil moisture needs. Consider reviewing planned irrigation to conserve water and prevent waterlogging.',
        windMessage: ''
      },
      'tilling': {
        rainRisk: 'medium',
        windRisk: 'low',
        rainMessage: 'Heavy rain can cause wet soil compaction and clodding during tractor tilling.',
        windMessage: ''
      },
      'planting': {
        rainRisk: 'medium',
        windRisk: 'low',
        rainMessage: 'Heavy downpours may erode seedbeds or cause soil crusting.',
        windMessage: ''
      },
      'general_outdoor': {
        rainRisk: 'medium',
        windRisk: 'medium',
        rainMessage: 'Outdoor fieldwork may be impeded by wet field conditions.',
        windMessage: 'Gusty conditions may affect field work safety.'
      }
    };
  }

  /**
   * Evaluates a single task against the daily forecast matching the task date.
   * 
   * @param {object} task - { id, title, type, date, status, notes }
   * @param {object} weatherData - Structured Open-Meteo forecast data
   * @returns {object} Advisory result
   */
  evaluateTask(task, weatherData) {
    if (!weatherData || !weatherData.daily || !Array.isArray(weatherData.daily)) {
      return {
        hasAdvisory: false,
        severity: 'neutral',
        badge: 'No Weather Data',
        title: 'Weather data not available for this task date',
        notes: 'Please refresh the weather forecast for this farm.',
        requiresFarmerApproval: false
      };
    }

    // Match forecast date (YYYY-MM-DD)
    const taskDateStr = task.date; // e.g. "2026-10-28"
    const dailyForecast = weatherData.daily.find(d => d.date === taskDateStr);

    if (!dailyForecast) {
      return {
        hasAdvisory: false,
        severity: 'neutral',
        badge: 'Forecast Out of Range',
        title: 'Task date exceeds the 7-day forecast window',
        notes: 'Weather advisories are available for tasks within the 7-day forecast horizon.',
        requiresFarmerApproval: false
      };
    }

    const taskSensitivity = this.weatherSensitiveTypes[task.type] || this.weatherSensitiveTypes['general_outdoor'];
    const precipProb = dailyForecast.precipProbabilityMax ?? 0;
    const precipSum = dailyForecast.precipSum ?? 0;
    const tempMax = dailyForecast.tempMax ?? 0;
    const currentWind = weatherData.current?.windSpeed ?? 0;

    const advisories = [];
    let severity = 'info'; // 'info', 'warning', 'alert'

    // 1. Rain / Precipitation Evaluation
    if (precipProb >= 60 || precipSum >= 5.0) {
      severity = 'alert';
      advisories.push({
        type: 'rain',
        level: 'high',
        text: `Forecast indicates high rain probability (${precipProb}%, ~${precipSum} ${dailyForecast.precipSumUnit}). ${taskSensitivity.rainMessage}`
      });
    } else if (precipProb >= 35 || precipSum >= 1.5) {
      if (severity !== 'alert') severity = 'warning';
      advisories.push({
        type: 'rain',
        level: 'moderate',
        text: `Moderate chance of precipitation (${precipProb}%, ~${precipSum} ${dailyForecast.precipSumUnit}). Monitor local conditions before starting.`
      });
    }

    // 2. Wind Evaluation (especially for spraying)
    if ((task.type === 'spray_pesticide' || task.type === 'fertilizer') && currentWind >= 18) {
      severity = 'alert';
      advisories.push({
        type: 'wind',
        level: 'high',
        text: `Elevated wind speed reported (${currentWind} ${weatherData.current.windSpeedUnit}). ${taskSensitivity.windMessage}`
      });
    }

    // 3. Extreme Heat Evaluation
    if (tempMax >= 36) {
      advisories.push({
        type: 'heat',
        level: 'moderate',
        text: `High daytime temperature (${tempMax} ${dailyForecast.tempMaxUnit}) forecast. Schedule outdoor field labor during cooler early morning or evening hours.`
      });
    }

    if (advisories.length === 0) {
      return {
        hasAdvisory: false,
        severity: 'favorable',
        badge: 'Favorable Forecast',
        title: 'Weather conditions forecast to be favorable',
        notes: `Max ${dailyForecast.tempMax}°C / Min ${dailyForecast.tempMin}°C, ${precipProb}% rain probability.`,
        forecastSummary: dailyForecast,
        requiresFarmerApproval: false
      };
    }

    return {
      hasAdvisory: true,
      severity,
      badge: severity === 'alert' ? 'Action Recommended' : 'Weather Advisory',
      title: severity === 'alert'
        ? 'Recommendation: Review Task Timing'
        : 'Weather Notice for Task',
      points: advisories,
      disclaimer: 'Note: Forecasts indicate probabilities and do not guarantee rain. Any schedule modification requires farmer discretion and approval.',
      forecastSummary: dailyForecast,
      requiresFarmerApproval: true
    };
  }

  /**
   * Evaluates all tasks for a farm and compiles a summary report.
   * 
   * @param {Array<object>} tasks 
   * @param {object} weatherData 
   * @returns {Array<object>} Tasks annotated with advisories
   */
  evaluateSchedule(tasks, weatherData) {
    if (!Array.isArray(tasks)) return [];
    return tasks.map(task => {
      const advisory = this.evaluateTask(task, weatherData);
      return {
        ...task,
        advisory
      };
    });
  }
}

// Export singleton
window.scheduleAdvisoryEngine = new ScheduleAdvisoryEngine();
