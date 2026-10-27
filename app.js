/**
 * AFOS - Adaptive Farm Operations System
 * Main Controller Application
 * 
 * Includes:
 * - Cyber-Agro Dark/Light Theme Switching
 * - Slide-out Drawer Navigation
 * - Mobile/Desktop Bottom Tab Navigation
 * - Open-Meteo Weather & Farming Schedule Telemetry
 * - Firebase Authentication & Farm Coordinates Management
 */

class AfosApp {
  constructor() {
    this.farms = [];
    this.activeFarm = null;
    this.activeWeather = null;
    this.activeTasks = [];
    this.currentUser = null;
    this.currentTheme = localStorage.getItem('afos_theme') || 'dark';
    this.weatherUI = new WeatherUI('weather-section-container');

    this.init();
  }

  async init() {
    this.initTheme();
    this.bindGlobalEvents();
    this.bindDrawerAndTabs();
    this.initAuth();
    await this.loadFarms();
  }

  // --- Theme Management ---
  initTheme() {
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    this.updateThemeIcons(this.currentTheme);
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    localStorage.setItem('afos_theme', this.currentTheme);
    this.updateThemeIcons(this.currentTheme);
  }

  updateThemeIcons(theme) {
    const icon = document.querySelector('.theme-icon');
    if (icon) {
      icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  // --- Auth State Management ---
  initAuth() {
    if (window.authService) {
      window.authService.onAuthStateChanged((user) => {
        this.currentUser = user;
        this.updateAuthUI(user);
      });
    }
  }

  updateAuthUI(user) {
    const authActions = document.getElementById('header-auth-actions');
    const userProfile = document.getElementById('header-user-profile');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const userRole = document.getElementById('user-role');

    // Drawer Elements
    const drawerAvatar = document.getElementById('drawer-avatar');
    const drawerUserName = document.getElementById('drawer-user-name');
    const drawerUserStatus = document.getElementById('drawer-user-status');
    const drawerAuthBtn = document.getElementById('btn-drawer-auth');

    if (user) {
      if (authActions) authActions.style.display = 'none';
      if (userProfile) userProfile.style.display = 'flex';

      const initial = (user.displayName || user.email || 'F')[0].toUpperCase();
      const displayName = user.displayName || user.email.split('@')[0];
      const roleText = user.isGuest ? 'Guest Farmer' : 'Verified Farmer';

      if (userAvatar) userAvatar.textContent = initial;
      if (userName) userName.textContent = displayName;
      if (userRole) userRole.textContent = roleText;

      if (drawerAvatar) drawerAvatar.textContent = initial;
      if (drawerUserName) drawerUserName.textContent = displayName;
      if (drawerUserStatus) drawerUserStatus.textContent = user.isGuest ? '⚡ Guest Mode' : '✅ Verified Account';
      if (drawerAuthBtn) {
        drawerAuthBtn.textContent = 'Logout';
        drawerAuthBtn.onclick = () => this.handleSignOut();
      }

      this.closeAuthModal();
    } else {
      if (authActions) authActions.style.display = 'flex';
      if (userProfile) userProfile.style.display = 'none';

      if (drawerAvatar) drawerAvatar.textContent = '🌾';
      if (drawerUserName) drawerUserName.textContent = 'Guest Farmer';
      if (drawerUserStatus) drawerUserStatus.textContent = 'Explore Live Features';
      if (drawerAuthBtn) {
        drawerAuthBtn.textContent = 'Login';
        drawerAuthBtn.onclick = () => this.openAuthModal('login');
      }
    }
  }

  // --- Drawer & Bottom Tab Bar Handlers ---
  bindDrawerAndTabs() {
    const drawer = document.getElementById('nav-drawer');
    const overlay = document.getElementById('drawer-overlay');
    const openBtn = document.getElementById('btn-open-drawer');
    const closeBtn = document.getElementById('btn-close-drawer');

    const openDrawer = () => {
      drawer?.classList.add('open');
      if (overlay) overlay.style.display = 'block';
    };

    const closeDrawer = () => {
      drawer?.classList.remove('open');
      if (overlay) overlay.style.display = 'none';
    };

    openBtn?.addEventListener('click', openDrawer);
    closeBtn?.addEventListener('click', closeDrawer);
    overlay?.addEventListener('click', closeDrawer);

    // Escape key closes drawer and modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDrawer();
        this.closeAuthModal();
        this.closeCoordinateModal();
      }
    });

    // Drawer links smooth scroll
    document.querySelectorAll('[data-drawer-nav]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('data-drawer-nav');
        this.scrollToSection(target);
        closeDrawer();
      });
    });

    // Drawer specific actions
    document.getElementById('btn-drawer-coords')?.addEventListener('click', () => {
      closeDrawer();
      this.openCoordinateModal();
    });

    document.getElementById('btn-drawer-refresh-weather')?.addEventListener('click', () => {
      closeDrawer();
      this.fetchAndRenderWeather(true);
    });

    document.getElementById('btn-drawer-theme-toggle')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Bottom Tab Bar Items
    document.querySelectorAll('#bottom-tab-bar .tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        const navTarget = tab.getAttribute('data-tab-nav');
        const navAction = tab.getAttribute('data-tab-action');

        if (navTarget) {
          this.setActiveBottomTab(navTarget);
          this.scrollToSection(navTarget);
        } else if (navAction === 'coords') {
          this.openCoordinateModal();
        } else if (navAction === 'auth') {
          if (this.currentUser) {
            this.handleSignOut();
          } else {
            this.openAuthModal('login');
          }
        }
      });
    });

    // Sync active bottom tab on scroll
    window.addEventListener('scroll', () => {
      this.syncActiveTabOnScroll();
    }, { passive: true });
  }

  scrollToSection(sectionKey) {
    let el = null;
    if (sectionKey === 'overview') el = document.getElementById('section-overview');
    else if (sectionKey === 'weather') el = document.getElementById('section-weather');
    else if (sectionKey === 'schedule') el = document.getElementById('section-schedule');

    if (el) {
      const offsetTop = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: offsetTop, behavior: 'smooth' });
    }
  }

  setActiveBottomTab(sectionKey) {
    document.querySelectorAll('#bottom-tab-bar .tab-item').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-tab-nav') === sectionKey);
    });

    document.querySelectorAll('[data-drawer-nav]').forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-drawer-nav') === sectionKey);
    });
  }

  syncActiveTabOnScroll() {
    const sections = [
      { key: 'overview', el: document.getElementById('section-overview') },
      { key: 'weather', el: document.getElementById('section-weather') },
      { key: 'schedule', el: document.getElementById('section-schedule') }
    ];

    const scrollPos = window.scrollY + 120;
    for (let i = sections.length - 1; i >= 0; i--) {
      const s = sections[i];
      if (s.el && s.el.offsetTop <= scrollPos) {
        this.setActiveBottomTab(s.key);
        break;
      }
    }
  }

  // --- Global Event Listeners ---
  bindGlobalEvents() {
    // Farm selector change
    const farmSelect = document.getElementById('farm-select');
    if (farmSelect) {
      farmSelect.addEventListener('change', (e) => {
        this.selectFarm(e.target.value);
      });
    }

    // Header Quick Actions
    document.getElementById('btn-theme-toggle')?.addEventListener('click', () => this.toggleTheme());
    document.getElementById('btn-quick-edit-coords')?.addEventListener('click', () => this.openCoordinateModal());

    // Coordinate Modal close & save
    document.getElementById('btn-modal-close')?.addEventListener('click', () => this.closeCoordinateModal());
    document.getElementById('btn-modal-cancel')?.addEventListener('click', () => this.closeCoordinateModal());
    document.getElementById('btn-save-coords')?.addEventListener('click', () => this.saveCoordinatesFromModal());

    // Coordinate presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lat = e.target.getAttribute('data-lat');
        const lon = e.target.getAttribute('data-lon');
        const loc = e.target.getAttribute('data-loc');
        document.getElementById('input-farm-lat').value = lat;
        document.getElementById('input-farm-lon').value = lon;
        if (loc) {
          document.getElementById('input-farm-loc').value = loc;
        }
      });
    });

    // Device GPS helper
    document.getElementById('btn-detect-gps')?.addEventListener('click', () => this.detectDeviceGps());

    // Quick Task Review Actions
    document.getElementById('tasks-container')?.addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('btn-task-action')) {
        const taskId = target.getAttribute('data-task-id');
        const action = target.getAttribute('data-action');
        this.handleTaskReviewAction(taskId, action);
      }
    });

    // --- Authentication Events ---
    document.getElementById('btn-open-auth')?.addEventListener('click', () => this.openAuthModal('login'));
    document.getElementById('btn-auth-close')?.addEventListener('click', () => this.closeAuthModal());
    document.getElementById('btn-logout')?.addEventListener('click', () => this.handleSignOut());

    // Switch between Sign In and Register tabs
    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.target.getAttribute('data-tab');
        this.switchAuthTab(mode);
      });
    });

    // Sign In form submit
    document.getElementById('form-login')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLoginSubmit();
    });

    // Register form submit
    document.getElementById('form-register')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegisterSubmit();
    });

    // Google Sign-In
    document.getElementById('btn-google-auth')?.addEventListener('click', () => this.handleGoogleAuth());

    // Guest / Demo Mode
    document.getElementById('btn-guest-auth')?.addEventListener('click', () => this.handleGuestAuth());
  }

  // --- Auth Modal & Logic ---
  openAuthModal(defaultTab = 'login') {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.style.display = 'flex';
      this.switchAuthTab(defaultTab);
      this.clearAuthErrors();
    }
  }

  closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
  }

  switchAuthTab(mode) {
    document.querySelectorAll('.auth-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === mode);
    });

    const loginSection = document.getElementById('auth-login-pane');
    const registerSection = document.getElementById('auth-register-pane');
    if (loginSection && registerSection) {
      if (mode === 'login') {
        loginSection.style.display = 'block';
        registerSection.style.display = 'none';
      } else {
        loginSection.style.display = 'none';
        registerSection.style.display = 'block';
      }
    }
    this.clearAuthErrors();
  }

  clearAuthErrors() {
    const errBox = document.getElementById('auth-error-msg');
    if (errBox) {
      errBox.style.display = 'none';
      errBox.textContent = '';
    }
  }

  showAuthError(message) {
    const errBox = document.getElementById('auth-error-msg');
    if (errBox) {
      errBox.textContent = message;
      errBox.style.display = 'block';
    }
  }

  async handleLoginSubmit() {
    const email = document.getElementById('login-email')?.value.trim();
    const pass = document.getElementById('login-password')?.value;
    const btn = document.getElementById('btn-submit-login');

    if (!email || !pass) {
      this.showAuthError('Please enter both email and password.');
      return;
    }

    try {
      if (btn) btn.disabled = true;
      if (btn) btn.textContent = 'Signing in...';
      this.clearAuthErrors();

      await window.authService.signIn(email, pass);
    } catch (err) {
      this.showAuthError(err.message || 'Login failed. Please check credentials.');
    } finally {
      if (btn) btn.disabled = false;
      if (btn) btn.textContent = 'Sign In to AFOS';
    }
  }

  async handleRegisterSubmit() {
    const name = document.getElementById('reg-name')?.value.trim();
    const email = document.getElementById('reg-email')?.value.trim();
    const pass = document.getElementById('reg-password')?.value;
    const passConfirm = document.getElementById('reg-password-confirm')?.value;
    const btn = document.getElementById('btn-submit-register');

    if (!name || !email || !pass) {
      this.showAuthError('All fields are required to register.');
      return;
    }

    if (pass !== passConfirm) {
      this.showAuthError('Passwords do not match. Please re-enter.');
      return;
    }

    if (pass.length < 6) {
      this.showAuthError('Password must be at least 6 characters long.');
      return;
    }

    try {
      if (btn) btn.disabled = true;
      if (btn) btn.textContent = 'Creating account...';
      this.clearAuthErrors();

      await window.authService.register(email, pass, name);
    } catch (err) {
      this.showAuthError(err.message || 'Registration failed.');
    } finally {
      if (btn) btn.disabled = false;
      if (btn) btn.textContent = 'Create Farmer Account';
    }
  }

  async handleGoogleAuth() {
    try {
      this.clearAuthErrors();
      await window.authService.signInWithGoogle();
    } catch (err) {
      this.showAuthError(err.message || 'Google sign-in error.');
    }
  }

  handleGuestAuth() {
    window.authService.continueAsGuest('Demo Farmer');
  }

  async handleSignOut() {
    if (confirm('Are you sure you want to sign out?')) {
      await window.authService.signOut();
    }
  }

  // --- Farm Data & Weather Management ---
  async loadFarms() {
    try {
      this.farms = await window.farmDataService.getFarms();
      this.populateFarmSelector();

      if (this.farms.length > 0) {
        await this.selectFarm(this.farms[0].id);
      } else {
        this.showNoFarmsView();
      }
    } catch (err) {
      console.error('[AFOS] Error loading farms:', err);
      this.weatherUI.showError('Could not load farm records from database.', () => this.loadFarms());
    }
  }

  populateFarmSelector() {
    const selector = document.getElementById('farm-select');
    if (!selector) return;

    selector.innerHTML = this.farms.map(f => `
      <option value="${f.id}">🏡 ${f.name} (${f.locationName || 'Coordinates'})</option>
    `).join('');
  }

  async selectFarm(farmId) {
    this.activeFarm = this.farms.find(f => f.id === farmId) || this.farms[0];
    if (!this.activeFarm) return;

    const badge = document.getElementById('active-farm-crop');
    if (badge) {
      badge.textContent = `Crop: ${this.activeFarm.cropType || 'Mixed'} • Area: ${this.activeFarm.areaAcres || '--'} Acres`;
    }

    if (this.activeFarm.latitude === undefined || this.activeFarm.longitude === undefined ||
        this.activeFarm.latitude === null || this.activeFarm.longitude === null) {
      this.weatherUI.showError(
        `Farm "${this.activeFarm.name}" does not have latitude and longitude coordinates assigned. Please set coordinates to load local forecasts.`,
        null,
        () => this.openCoordinateModal()
      );
      this.renderTasks([]);
      return;
    }

    await this.fetchAndRenderWeather(false);
    await this.loadAndEvaluateSchedule();
  }

  async fetchAndRenderWeather(forceRefresh = false) {
    if (!this.activeFarm) return;

    this.weatherUI.showLoading(this.activeFarm.name);

    const result = await window.weatherService.fetchForecast(
      this.activeFarm.latitude,
      this.activeFarm.longitude,
      forceRefresh
    );

    if (result.success) {
      this.activeWeather = result.data;
      this.weatherUI.renderWeather(
        result.data,
        this.activeFarm,
        result.fromCache,
        () => this.fetchAndRenderWeather(true),
        () => this.openCoordinateModal()
      );
    } else {
      this.activeWeather = null;
      this.weatherUI.showError(
        result.error,
        () => this.fetchAndRenderWeather(true),
        () => this.openCoordinateModal()
      );
    }
  }

  async loadAndEvaluateSchedule() {
    if (!this.activeFarm) return;

    this.activeTasks = await window.farmDataService.getFarmTasks(this.activeFarm.id);
    const evaluatedTasks = window.scheduleAdvisoryEngine.evaluateSchedule(
      this.activeTasks,
      this.activeWeather
    );

    this.renderTasks(evaluatedTasks);
  }

  renderTasks(tasks) {
    const container = document.getElementById('tasks-container');
    const advisorySummaryBanner = document.getElementById('schedule-advisory-banner');
    const tabAdvisoryDot = document.getElementById('tab-advisory-dot');
    const drawerAdvisoryCount = document.getElementById('drawer-advisory-count');
    if (!container) return;

    if (!tasks || tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-tasks-card">
          <p>🌱 No scheduled operations found for this farm parcel.</p>
        </div>
      `;
      if (advisorySummaryBanner) advisorySummaryBanner.style.display = 'none';
      if (tabAdvisoryDot) tabAdvisoryDot.style.display = 'none';
      if (drawerAdvisoryCount) drawerAdvisoryCount.style.display = 'none';
      return;
    }

    const alertCount = tasks.filter(t => t.advisory?.severity === 'alert').length;
    const warningCount = tasks.filter(t => t.advisory?.severity === 'warning').length;
    const totalAdvisories = alertCount + warningCount;

    // Update bottom tab badge & drawer badge
    if (tabAdvisoryDot) {
      tabAdvisoryDot.style.display = totalAdvisories > 0 ? 'block' : 'none';
    }
    if (drawerAdvisoryCount) {
      drawerAdvisoryCount.textContent = totalAdvisories.toString();
      drawerAdvisoryCount.style.display = totalAdvisories > 0 ? 'inline-block' : 'none';
    }

    if (advisorySummaryBanner) {
      if (alertCount > 0 || warningCount > 0) {
        advisorySummaryBanner.style.display = 'block';
        advisorySummaryBanner.innerHTML = `
          <div class="advisory-banner-content">
            <div class="banner-icon">⚠️</div>
            <div class="banner-text">
              <strong>Weather Decision Advisory: ${alertCount} High-Risk & ${warningCount} Moderate Task Advisories</strong>
              <p>Forecast models suggest weather risks for outdoor operations. As an adaptive decision support system, AFOS does <em>not</em> modify approved schedules automatically. Please review recommendations below and confirm any operational adjustments.</p>
            </div>
          </div>
        `;
      } else {
        advisorySummaryBanner.style.display = 'block';
        advisorySummaryBanner.innerHTML = `
          <div class="advisory-banner-content favorable-banner">
            <div class="banner-icon">✅</div>
            <div class="banner-text">
              <strong>Forecast Conditions Favorable for Operations</strong>
              <p>Current 7-day Open-Meteo forecasts indicate conditions suitable for scheduled farm tasks. Review is recommended prior to field application.</p>
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = tasks.map(task => {
      const adv = task.advisory;
      const isAlert = adv?.severity === 'alert';
      const isWarning = adv?.severity === 'warning';
      const isFavorable = adv?.severity === 'favorable';

      let cardClass = 'task-card';
      if (isAlert) cardClass += ' task-card-alert';
      else if (isWarning) cardClass += ' task-card-warning';

      return `
        <div class="${cardClass}" id="task-${task.id}">
          <div class="task-header-row">
            <div class="task-type-badge">${this.getTaskTypeIcon(task.type)} ${this.formatTaskType(task.type)}</div>
            <span class="task-date-badge">📅 ${task.date}</span>
            <span class="task-status-badge status-${task.status.toLowerCase().replace(/\s+/g, '-')}">${task.status}</span>
          </div>

          <h4 class="task-title">${this.escapeHtml(task.title)}</h4>
          <p class="task-notes">${this.escapeHtml(task.notes || '')}</p>

          ${adv?.hasAdvisory ? `
            <div class="task-advisory-callout ${adv.severity}">
              <div class="callout-header">
                <span class="callout-badge">${adv.badge}</span>
                <span class="callout-title">${adv.title}</span>
              </div>
              <ul class="callout-points">
                ${adv.points.map(p => `<li>${p.text}</li>`).join('')}
              </ul>
              <div class="callout-disclaimer">
                ℹ️ <em>${adv.disclaimer}</em>
              </div>

              <div class="farmer-action-bar">
                <span class="farmer-action-label">Farmer Decision:</span>
                <button class="btn btn-sm btn-outline btn-task-action" data-task-id="${task.id}" data-action="approved">
                  ✓ Keep Schedule (Approved)
                </button>
                <button class="btn btn-sm btn-warning btn-task-action" data-task-id="${task.id}" data-action="reschedule">
                  ⏳ Review & Reschedule
                </button>
                <button class="btn btn-sm btn-secondary btn-task-action" data-task-id="${task.id}" data-action="completed">
                  ✅ Mark Done
                </button>
              </div>
            </div>
          ` : isFavorable ? `
            <div class="task-advisory-favorable">
              <span>🌤️ Forecast: ${adv.notes}</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  async handleTaskReviewAction(taskId, action) {
    let newStatus = 'Scheduled';
    let appendNote = '';

    if (action === 'approved') {
      newStatus = 'Farmer Approved';
      appendNote = ' [Farmer reviewed weather advisory: original schedule confirmed]';
    } else if (action === 'reschedule') {
      newStatus = 'Under Reschedule Review';
      appendNote = ' [Farmer flagged for reschedule due to rain/wind advisory]';
    } else if (action === 'completed') {
      newStatus = 'Completed';
    }

    const task = this.activeTasks.find(t => t.id === taskId);
    if (task) {
      const updatedNotes = (task.notes || '') + (appendNote && !task.notes.includes(appendNote) ? appendNote : '');
      await window.farmDataService.updateTaskStatus(taskId, newStatus, updatedNotes);
      await this.loadAndEvaluateSchedule();
    }
  }

  // --- Modal Coordinates Helpers ---
  openCoordinateModal() {
    if (!this.activeFarm) return;

    document.getElementById('modal-farm-name').textContent = this.activeFarm.name;
    document.getElementById('input-farm-lat').value = this.activeFarm.latitude ?? '';
    document.getElementById('input-farm-lon').value = this.activeFarm.longitude ?? '';
    document.getElementById('input-farm-loc').value = this.activeFarm.locationName ?? '';
    document.getElementById('modal-error-msg').style.display = 'none';

    const modal = document.getElementById('coords-modal');
    if (modal) modal.style.display = 'flex';
  }

  closeCoordinateModal() {
    const modal = document.getElementById('coords-modal');
    if (modal) modal.style.display = 'none';
  }

  async saveCoordinatesFromModal() {
    if (!this.activeFarm) return;

    const latVal = document.getElementById('input-farm-lat').value.trim();
    const lonVal = document.getElementById('input-farm-lon').value.trim();
    const locVal = document.getElementById('input-farm-loc').value.trim();
    const errorBox = document.getElementById('modal-error-msg');

    const validation = window.weatherService.validateCoordinates(latVal, lonVal);
    if (!validation.valid) {
      errorBox.textContent = validation.error;
      errorBox.style.display = 'block';
      return;
    }

    try {
      errorBox.style.display = 'none';
      await window.farmDataService.updateFarmCoordinates(
        this.activeFarm.id,
        validation.lat,
        validation.lon,
        locVal || null
      );

      window.weatherService.clearCache(validation.lat, validation.lon);

      this.activeFarm.latitude = validation.lat;
      this.activeFarm.longitude = validation.lon;
      if (locVal) this.activeFarm.locationName = locVal;

      this.closeCoordinateModal();

      await this.fetchAndRenderWeather(true);
      await this.loadAndEvaluateSchedule();
    } catch (err) {
      errorBox.textContent = err.message || 'Error saving coordinates.';
      errorBox.style.display = 'block';
    }
  }

  detectDeviceGps() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    const btn = document.getElementById('btn-detect-gps');
    if (btn) btn.textContent = '🛰️ Acquiring GPS...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        document.getElementById('input-farm-lat').value = pos.coords.latitude.toFixed(4);
        document.getElementById('input-farm-lon').value = pos.coords.longitude.toFixed(4);
        if (btn) btn.textContent = '🛰️ Use Current Device Location';
      },
      (err) => {
        alert(`Geolocation error: ${err.message}`);
        if (btn) btn.textContent = '🛰️ Use Current Device Location';
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  getTaskTypeIcon(type) {
    switch (type) {
      case 'fertilizer': return '🧪';
      case 'spray_pesticide': return '🚜';
      case 'irrigation': return '💧';
      case 'harvesting': return '🌾';
      case 'tilling': return '🌱';
      default: return '📋';
    }
  }

  formatTaskType(type) {
    if (!type) return 'General Task';
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.afosApp = new AfosApp();
});
