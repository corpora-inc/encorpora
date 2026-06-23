/**
 * BrushConfigWidget - Professional brush configuration panel
 * Floating, draggable panel with tabs for different settings.
 */

import { BUILTIN_PRESETS, getAllPresets } from './presets.js';
import { PressureCurveCanvas } from './PressureCurveCanvas.js';
import { StrokePreviewCanvas } from './StrokePreviewCanvas.js';

export class BrushConfigWidget {
  constructor(options = {}) {
    const {
      container,
      store,
      getColors,
      onConfigChange,
    } = options;

    this.container = container;
    this.store = store;
    this.getColors = getColors || (() => ({ stroke: '#0f8b8d' }));
    this.onConfigChange = onConfigChange;
    this.visible = false;
    this.activeTab = 'size';
    this.dragState = null;

    this.pressureCurve = null;
    this.strokePreview = null;

    this._createDOM();
    this._attachEvents();
    this._syncFromStore();

    // Subscribe to store changes
    if (this.store && typeof this.store.subscribe === 'function') {
      this._unsubscribe = this.store.subscribe(() => {
        this._syncFromStore();
      });
    }
  }

  _createDOM() {
    // Backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'brush-widget-backdrop';
    this.backdrop.style.display = 'none';

    // Panel
    this.panel = document.createElement('div');
    this.panel.className = 'brush-widget-panel';
    this.panel.style.display = 'none';

    // Header (draggable)
    const header = document.createElement('div');
    header.className = 'brush-widget-header';

    const title = document.createElement('span');
    title.className = 'brush-widget-title';
    title.textContent = 'Brush Settings';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'brush-widget-close';
    closeBtn.type = 'button';
    closeBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/></svg>`;
    closeBtn.addEventListener('click', () => this.hide());

    header.appendChild(title);
    header.appendChild(closeBtn);
    this.header = header;

    // Preset row
    const presetRow = document.createElement('div');
    presetRow.className = 'brush-widget-preset-row';

    this.presetSelect = document.createElement('select');
    this.presetSelect.className = 'brush-widget-select';
    this._populatePresets();

    const presetBtns = document.createElement('div');
    presetBtns.className = 'brush-widget-preset-btns';

    this.saveBtn = document.createElement('button');
    this.saveBtn.className = 'brush-widget-btn';
    this.saveBtn.type = 'button';
    this.saveBtn.textContent = 'Save';

    this.deleteBtn = document.createElement('button');
    this.deleteBtn.className = 'brush-widget-btn brush-widget-btn-danger';
    this.deleteBtn.type = 'button';
    this.deleteBtn.textContent = 'Delete';

    this.resetBtn = document.createElement('button');
    this.resetBtn.className = 'brush-widget-btn';
    this.resetBtn.type = 'button';
    this.resetBtn.textContent = 'Reset';

    presetBtns.appendChild(this.saveBtn);
    presetBtns.appendChild(this.deleteBtn);
    presetBtns.appendChild(this.resetBtn);

    presetRow.appendChild(this.presetSelect);
    presetRow.appendChild(presetBtns);

    // Preview area
    const previewSection = document.createElement('div');
    previewSection.className = 'brush-widget-preview';
    this.previewContainer = previewSection;

    // Tabs
    const tabBar = document.createElement('div');
    tabBar.className = 'brush-widget-tabs';

    const tabs = [
      { id: 'size', label: 'Size & Dynamics' },
      { id: 'pressure', label: 'Pressure' },
      { id: 'smoothing', label: 'Smoothing' },
      { id: 'taper', label: 'Taper' },
    ];

    this.tabButtons = {};
    tabs.forEach(({ id, label }) => {
      const btn = document.createElement('button');
      btn.className = 'brush-widget-tab';
      btn.type = 'button';
      btn.textContent = label;
      btn.dataset.tab = id;
      btn.addEventListener('click', () => this._setActiveTab(id));
      tabBar.appendChild(btn);
      this.tabButtons[id] = btn;
    });

    // Tab content
    this.tabContent = document.createElement('div');
    this.tabContent.className = 'brush-widget-content';

    // Build panel
    this.panel.appendChild(header);
    this.panel.appendChild(presetRow);
    this.panel.appendChild(previewSection);
    this.panel.appendChild(tabBar);
    this.panel.appendChild(this.tabContent);

    // Add to container
    if (this.container) {
      this.container.appendChild(this.backdrop);
      this.container.appendChild(this.panel);
    }

    // Initialize components
    this._initPreview();
    this._setActiveTab('size');
  }

  _initPreview() {
    this.strokePreview = new StrokePreviewCanvas({
      container: this.previewContainer,
      width: 280,
      height: 100,
      getConfig: () => this.store ? this.store.getConfig() : {},
      getColors: this.getColors,
    });
  }

  _populatePresets() {
    this.presetSelect.innerHTML = '';
    const userPresets = this.store ? this.store.getUserPresets() : [];
    const allPresets = getAllPresets(userPresets);
    const activeId = this.store ? this.store.getActivePresetId() : 'default';

    allPresets.forEach((preset) => {
      const opt = document.createElement('option');
      opt.value = preset.id;
      opt.textContent = preset.isBuiltIn ? preset.name : `${preset.name} (Custom)`;
      if (preset.id === activeId) {
        opt.selected = true;
      }
      this.presetSelect.appendChild(opt);
    });
  }

  _setActiveTab(tabId) {
    this.activeTab = tabId;
    Object.entries(this.tabButtons).forEach(([id, btn]) => {
      btn.classList.toggle('active', id === tabId);
    });
    this._renderTabContent();
  }

  _renderTabContent() {
    this.tabContent.innerHTML = '';
    const config = this.store ? this.store.getConfig() : {};

    if (this.activeTab === 'size') {
      this._renderSizeTab(config);
    } else if (this.activeTab === 'pressure') {
      this._renderPressureTab(config);
    } else if (this.activeTab === 'smoothing') {
      this._renderSmoothingTab(config);
    } else if (this.activeTab === 'taper') {
      this._renderTaperTab(config);
    }
  }

  _createSlider(label, key, min, max, step, value, unit = '') {
    const row = document.createElement('div');
    row.className = 'brush-widget-slider-row';

    const labelEl = document.createElement('label');
    labelEl.className = 'brush-widget-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'brush-widget-value';
    valueEl.textContent = `${value.toFixed(step < 1 ? 2 : 0)}${unit}`;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'brush-widget-slider';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;

    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      valueEl.textContent = `${val.toFixed(step < 1 ? 2 : 0)}${unit}`;
      this._updateConfig({ [key]: val });
    });

    const labelRow = document.createElement('div');
    labelRow.className = 'brush-widget-label-row';
    labelRow.appendChild(labelEl);
    labelRow.appendChild(valueEl);

    row.appendChild(labelRow);
    row.appendChild(slider);

    return row;
  }

  _createCheckbox(label, key, checked) {
    const row = document.createElement('div');
    row.className = 'brush-widget-checkbox-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'brush-widget-checkbox';
    checkbox.checked = checked;
    checkbox.id = `brush-${key}`;

    const labelEl = document.createElement('label');
    labelEl.className = 'brush-widget-checkbox-label';
    labelEl.htmlFor = checkbox.id;
    labelEl.textContent = label;

    checkbox.addEventListener('change', () => {
      this._updateConfig({ [key]: checkbox.checked });
    });

    row.appendChild(checkbox);
    row.appendChild(labelEl);

    return row;
  }

  _renderSizeTab(config) {
    this.tabContent.appendChild(
      this._createSlider('Base Size', 'baseWidthMultiplier', 0.5, 2.0, 0.05, config.baseWidthMultiplier || 1.0, 'x')
    );
    this.tabContent.appendChild(
      this._createSlider('Min Width', 'minWidthFactor', 0.1, 1.0, 0.05, config.minWidthFactor || 0.5, 'x')
    );
    this.tabContent.appendChild(
      this._createSlider('Max Width', 'maxWidthFactor', 1.0, 3.0, 0.1, config.maxWidthFactor || 1.6, 'x')
    );

    const divider = document.createElement('div');
    divider.className = 'brush-widget-divider';
    this.tabContent.appendChild(divider);

    this.tabContent.appendChild(
      this._createSlider('Velocity Influence', 'velocityInfluence', 0, 1, 0.05, config.velocityInfluence || 0.5)
    );
    this.tabContent.appendChild(
      this._createSlider('Velocity Range', 'velocityRange', 0.5, 5.0, 0.1, config.velocityRange || 2.0)
    );
    this.tabContent.appendChild(
      this._createCheckbox('Invert Velocity', 'velocityInverted', config.velocityInverted || false)
    );
  }

  _renderPressureTab(config) {
    this.tabContent.appendChild(
      this._createSlider('Pressure Influence', 'pressureInfluence', 0, 1, 0.05, config.pressureInfluence || 0.55)
    );
    this.tabContent.appendChild(
      this._createSlider('Pressure Exponent', 'pressureExponent', 0.2, 3.0, 0.05, config.pressureExponent || 0.75)
    );

    const curveLabel = document.createElement('div');
    curveLabel.className = 'brush-widget-section-label';
    curveLabel.textContent = 'Pressure Curve';
    this.tabContent.appendChild(curveLabel);

    const curveContainer = document.createElement('div');
    curveContainer.className = 'brush-widget-curve-container';
    this.tabContent.appendChild(curveContainer);

    // Destroy previous if exists
    if (this.pressureCurve) {
      this.pressureCurve.destroy();
    }

    this.pressureCurve = new PressureCurveCanvas({
      container: curveContainer,
      size: 200,
      initialCurve: config.pressureCurve,
      onChange: (curve) => {
        this._updateConfig({ pressureCurve: curve });
      },
    });
  }

  _renderSmoothingTab(config) {
    this.tabContent.appendChild(
      this._createSlider('Position Smoothing', 'positionSmoothing', 0, 0.9, 0.05, config.positionSmoothing || 0.2)
    );
    this.tabContent.appendChild(
      this._createSlider('Velocity Smoothing', 'velocitySmoothing', 0, 0.9, 0.05, config.velocitySmoothing || 0.25)
    );
    this.tabContent.appendChild(
      this._createSlider('Width Smoothing', 'widthSmoothing', 0, 0.9, 0.05, config.widthSmoothing || 0.3)
    );
  }

  _renderTaperTab(config) {
    const startLabel = document.createElement('div');
    startLabel.className = 'brush-widget-section-label';
    startLabel.textContent = 'Start Taper';
    this.tabContent.appendChild(startLabel);

    this.tabContent.appendChild(
      this._createSlider('Distance', 'startTaperDistance', 0, 5, 0.1, config.startTaperDistance || 1.8)
    );
    this.tabContent.appendChild(
      this._createSlider('Min Size', 'startTaperMin', 0.1, 1.0, 0.05, config.startTaperMin || 0.35, 'x')
    );

    const endLabel = document.createElement('div');
    endLabel.className = 'brush-widget-section-label';
    endLabel.textContent = 'End Taper';
    this.tabContent.appendChild(endLabel);

    this.tabContent.appendChild(
      this._createSlider('Points', 'endTaperPoints', 0, 20, 1, config.endTaperPoints || 6)
    );
    this.tabContent.appendChild(
      this._createSlider('Strength', 'endTaperStrength', 0, 1, 0.05, config.endTaperStrength || 0.5)
    );

    const dwellLabel = document.createElement('div');
    dwellLabel.className = 'brush-widget-section-label';
    dwellLabel.textContent = 'Dwell';
    this.tabContent.appendChild(dwellLabel);

    this.tabContent.appendChild(
      this._createSlider('Delay', 'dwellDelayMs', 0, 500, 10, config.dwellDelayMs || 120, 'ms')
    );
    this.tabContent.appendChild(
      this._createSlider('Growth Rate', 'dwellGrowthRate', 0, 2, 0.1, config.dwellGrowthRate || 0.7)
    );
    this.tabContent.appendChild(
      this._createSlider('Max Factor', 'dwellMaxFactor', 1, 4, 0.1, config.dwellMaxFactor || 2.2, 'x')
    );
  }

  _updateConfig(partial) {
    if (this.store) {
      this.store.setConfig(partial);
    }
    if (this.strokePreview) {
      this.strokePreview.refresh();
    }
    if (typeof this.onConfigChange === 'function') {
      this.onConfigChange(this.store ? this.store.getConfig() : partial);
    }
  }

  _syncFromStore() {
    this._populatePresets();
    this._renderTabContent();
    if (this.strokePreview) {
      this.strokePreview.refresh();
    }
    if (this.pressureCurve && this.store) {
      const config = this.store.getConfig();
      if (config.pressureCurve) {
        this.pressureCurve.setCurve(config.pressureCurve);
      }
    }
  }

  _attachEvents() {
    // Backdrop click to close
    this.backdrop.addEventListener('click', () => this.hide());

    // Preset selection
    this.presetSelect.addEventListener('change', () => {
      const id = this.presetSelect.value;
      const userPresets = this.store ? this.store.getUserPresets() : [];
      const allPresets = getAllPresets(userPresets);
      const preset = allPresets.find(p => p.id === id);
      if (preset && this.store) {
        this.store.loadPreset(preset);
      }
    });

    // Save preset
    this.saveBtn.addEventListener('click', () => {
      const name = prompt('Enter preset name:');
      if (name && name.trim() && this.store) {
        this.store.savePreset(name.trim());
        this._populatePresets();
      }
    });

    // Delete preset
    this.deleteBtn.addEventListener('click', () => {
      const id = this.presetSelect.value;
      const preset = getAllPresets(this.store ? this.store.getUserPresets() : []).find(p => p.id === id);
      if (!preset) return;
      if (preset.isBuiltIn) {
        alert('Cannot delete built-in presets.');
        return;
      }
      if (confirm(`Delete preset "${preset.name}"?`)) {
        if (this.store) {
          this.store.deletePreset(id);
          this._populatePresets();
        }
      }
    });

    // Reset to default
    this.resetBtn.addEventListener('click', () => {
      if (confirm('Reset to default settings?')) {
        if (this.store) {
          this.store.resetToDefault();
        }
      }
    });

    // Draggable header
    this.header.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.brush-widget-close')) return;
      e.preventDefault();
      const rect = this.panel.getBoundingClientRect();
      this.dragState = {
        startX: e.clientX,
        startY: e.clientY,
        panelX: rect.left,
        panelY: rect.top,
      };
      this.header.setPointerCapture(e.pointerId);
    });

    this.header.addEventListener('pointermove', (e) => {
      if (!this.dragState) return;
      const dx = e.clientX - this.dragState.startX;
      const dy = e.clientY - this.dragState.startY;
      this.panel.style.left = `${this.dragState.panelX + dx}px`;
      this.panel.style.top = `${this.dragState.panelY + dy}px`;
      this.panel.style.right = 'auto';
      this.panel.style.bottom = 'auto';
      this.panel.style.transform = 'none';
    });

    this.header.addEventListener('pointerup', (e) => {
      if (this.dragState) {
        this.header.releasePointerCapture(e.pointerId);
        this.dragState = null;
      }
    });

    // Keyboard escape
    this._keyHandler = (e) => {
      if (e.key === 'Escape' && this.visible) {
        this.hide();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  show() {
    this.visible = true;
    this.backdrop.style.display = 'block';
    this.panel.style.display = 'flex';
    // Reset position
    this.panel.style.left = '';
    this.panel.style.top = '';
    this.panel.style.right = '';
    this.panel.style.bottom = '';
    this.panel.style.transform = '';
    this._syncFromStore();
  }

  hide() {
    this.visible = false;
    this.backdrop.style.display = 'none';
    this.panel.style.display = 'none';
  }

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  isVisible() {
    return this.visible;
  }

  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe();
    }
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
    if (this.pressureCurve) {
      this.pressureCurve.destroy();
    }
    if (this.strokePreview) {
      this.strokePreview.destroy();
    }
    if (this.backdrop && this.backdrop.parentNode) {
      this.backdrop.parentNode.removeChild(this.backdrop);
    }
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }
  }
}

export default BrushConfigWidget;
