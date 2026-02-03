(function ($) {
  const data = window.MockMasterDesignerData || {};

  const placements = {
    'left-chest': {
      top: '32%',
      left: '62%',
      width: '18%',
      size: { min: 2, max: 6, default: 4.5 },
    },
    'right-chest': {
      top: '32%',
      left: '38%',
      width: '18%',
      size: { min: 2, max: 6, default: 4.5 },
    },
    'full-chest': {
      top: '34%',
      left: '50%',
      width: '40%',
      size: { min: 6, max: 12, default: 10 },
    },
    'left-sleeve': {
      top: '28%',
      left: '49%',
      width: '12%',
      size: { min: 1, max: 5, default: 3 },
    },
    'right-sleeve': {
      top: '28%',
      left: '51%',
      width: '12%',
      size: { min: 1, max: 5, default: 3 },
    },
    back: {
      top: '38%',
      left: '50%',
      width: '40%',
      size: { min: 6, max: 12, default: 10 },
    },
  };

  const placementLabels = {
    'left-chest': 'Left Chest',
    'right-chest': 'Right Chest',
    'full-chest': 'Full Chest',
    'left-sleeve': 'Left Sleeve',
    'right-sleeve': 'Right Sleeve',
    back: 'Back',
  };

  const COLOR_COUNTER_CONFIG = {
    MAX_WORKING_DIM: 2000,
    MAX_PREVIEW_DIM: 800,
    MAX_SAMPLES: 200000,
    DEFAULT_SEED: 1337,
    DEFAULT_MERGE_DISTANCE: 10,
  };

  function createSeededRandom(seed) {
    let value = seed >>> 0;
    return function () {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      return (value >>> 0) / 4294967296;
    };
  }

  function parseHexColor(hex) {
    const cleaned = String(hex || '').replace('#', '');
    if (cleaned.length !== 6) {
      return [255, 255, 255];
    }
    return [
      parseInt(cleaned.slice(0, 2), 16),
      parseInt(cleaned.slice(2, 4), 16),
      parseInt(cleaned.slice(4, 6), 16),
    ];
  }

  function rgbToHex(rgb) {
    return (
      '#' +
      rgb
        .map((value) => {
          const hex = Math.round(value).toString(16).padStart(2, '0');
          return hex.toUpperCase();
        })
        .join('')
    );
  }

  function normalizeHexColor(hex) {
    const cleaned = String(hex || '').replace('#', '');
    if (cleaned.length !== 6) {
      return '#FFFFFF';
    }
    return `#${cleaned.toUpperCase()}`;
  }

  function createCanvasFromImage(image, maxDimension, allowUpscale) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const max = Math.max(width, height);
    const scale = max > maxDimension ? maxDimension / max : allowUpscale ? maxDimension / max : 1;
    const clampedScale = allowUpscale ? scale : Math.min(1, scale);

    canvas.width = Math.max(1, Math.round(width * clampedScale));
    canvas.height = Math.max(1, Math.round(height * clampedScale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function parseSvgLength(value) {
    if (!value) {
      return null;
    }
    const match = String(value).trim().match(/^([0-9.]+)(px)?$/i);
    if (!match) {
      return null;
    }
    return parseFloat(match[1]);
  }

  function parseSvgSize(svgText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) {
      return { width: 1000, height: 1000 };
    }

    const widthAttr = parseSvgLength(svg.getAttribute('width'));
    const heightAttr = parseSvgLength(svg.getAttribute('height'));
    if (widthAttr && heightAttr) {
      return { width: widthAttr, height: heightAttr };
    }

    const viewBox = svg.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.trim().split(/\s+/).map(Number);
      if (parts.length === 4 && parts.every((part) => !Number.isNaN(part))) {
        return { width: parts[2], height: parts[3] };
      }
    }

    return { width: 1000, height: 1000 };
  }

  function loadImageFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = function () {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Unable to load image.'));
      };
      image.src = url;
    });
  }

  function buildWorkingCanvasFromRaster(file, maxDimension) {
    return loadImageFromBlob(file).then((image) => {
      const canvas = createCanvasFromImage(image, maxDimension, false);
      return { canvas, image };
    });
  }

  function buildWorkingCanvasFromSvg(file, maxDimension) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (event) {
        const svgText = event.target.result;
        const svgSize = parseSvgSize(svgText);
        const max = Math.max(svgSize.width, svgSize.height);
        const scale = max > maxDimension ? maxDimension / max : 1;
        const pixelRatio = window.devicePixelRatio || 1;
        const targetWidth = Math.max(1, Math.round(svgSize.width * scale * pixelRatio));
        const targetHeight = Math.max(1, Math.round(svgSize.height * scale * pixelRatio));
        const blob = new Blob([svgText], { type: 'image/svg+xml' });

        loadImageFromBlob(blob)
          .then((image) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) {
              reject(new Error('Unable to create canvas.'));
              return;
            }
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve({ canvas, image });
          })
          .catch(reject);
      };
      reader.onerror = function () {
        reject(new Error('Unable to read SVG.'));
      };
      reader.readAsText(file);
    });
  }

  function isSvgFile(file) {
    return file && (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || ''));
  }

  function createPreviewCanvasFromWorkingCanvas(workingCanvas, maxDimension) {
    const previewCanvas = document.createElement('canvas');
    const context = previewCanvas.getContext('2d');
    if (!context) {
      return null;
    }
    const width = workingCanvas.width;
    const height = workingCanvas.height;
    const max = Math.max(width, height);
    const scale = max > maxDimension ? maxDimension / max : 1;
    previewCanvas.width = Math.max(1, Math.round(width * scale));
    previewCanvas.height = Math.max(1, Math.round(height * scale));
    context.drawImage(workingCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
    return previewCanvas;
  }

  function samplePixels(imageData, options) {
    const { alphaThreshold, compositeOnBackground, backgroundRgb, maxSamples } = options;
    const pixels = [];
    const data = imageData.data;
    const totalPixels = data.length / 4;
    const step = totalPixels > maxSamples ? Math.ceil(totalPixels / maxSamples) : 1;

    for (let i = 0; i < data.length; i += 4 * step) {
      const alpha = data[i + 3];
      if (alpha === 0 || alpha < alphaThreshold) {
        continue;
      }

      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      if (alpha < 255 && compositeOnBackground) {
        const ratio = alpha / 255;
        r = Math.round(r * ratio + backgroundRgb[0] * (1 - ratio));
        g = Math.round(g * ratio + backgroundRgb[1] * (1 - ratio));
        b = Math.round(b * ratio + backgroundRgb[2] * (1 - ratio));
      }

      pixels.push([r, g, b]);
    }

    return pixels;
  }

  function kMeansQuantize(pixels, k, seed) {
    if (!pixels.length) {
      return { centroids: [], assignments: [] };
    }

    const random = createSeededRandom(seed);
    const centroids = [];
    const assignments = new Array(pixels.length);

    for (let i = 0; i < k; i += 1) {
      const index = Math.floor(random() * pixels.length);
      centroids.push(pixels[index].slice());
    }

    const maxIterations = 10;
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);

      for (let i = 0; i < pixels.length; i += 1) {
        const pixel = pixels[i];
        let nearest = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;

        for (let c = 0; c < centroids.length; c += 1) {
          const centroid = centroids[c];
          const dr = pixel[0] - centroid[0];
          const dg = pixel[1] - centroid[1];
          const db = pixel[2] - centroid[2];
          const distance = dr * dr + dg * dg + db * db;
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = c;
          }
        }

        assignments[i] = nearest;
        sums[nearest][0] += pixel[0];
        sums[nearest][1] += pixel[1];
        sums[nearest][2] += pixel[2];
        sums[nearest][3] += 1;
      }

      for (let c = 0; c < centroids.length; c += 1) {
        if (sums[c][3] === 0) {
          const replacementIndex = Math.floor(random() * pixels.length);
          centroids[c] = pixels[replacementIndex].slice();
          continue;
        }
        centroids[c] = [
          sums[c][0] / sums[c][3],
          sums[c][1] / sums[c][3],
          sums[c][2] / sums[c][3],
        ];
      }
    }

    return { centroids, assignments };
  }

  function buildPalette(centroids, assignments, totalPixels, minPct, minPixels) {
    if (!centroids.length) {
      return [];
    }

    const counts = new Array(centroids.length).fill(0);
    assignments.forEach((cluster) => {
      counts[cluster] += 1;
    });

    const palette = centroids
      .map((centroid, index) => {
        const pixelCount = counts[index];
        const percent = totalPixels ? (pixelCount / totalPixels) * 100 : 0;
        return {
          rgb: centroid.map((value) => Math.round(value)),
          hex: rgbToHex(centroid),
          pixel_count: pixelCount,
          percent,
        };
      })
      .filter((entry) => {
        if (entry.pixel_count < minPixels) {
          return false;
        }
        return entry.percent >= minPct;
      })
      .sort((a, b) => b.percent - a.percent);

    return palette;
  }

  function mergePaletteByDistance(palette, totalPixels, threshold) {
    if (!palette.length) {
      return [];
    }

    const merged = [];

    palette.forEach((entry) => {
      const match = merged.find((candidate) => {
        const dr = candidate.rgb[0] - entry.rgb[0];
        const dg = candidate.rgb[1] - entry.rgb[1];
        const db = candidate.rgb[2] - entry.rgb[2];
        const distance = Math.sqrt(dr * dr + dg * dg + db * db);
        return distance < threshold;
      });

      if (match) {
        const combined = match.pixel_count + entry.pixel_count;
        match.rgb = [
          (match.rgb[0] * match.pixel_count + entry.rgb[0] * entry.pixel_count) / combined,
          (match.rgb[1] * match.pixel_count + entry.rgb[1] * entry.pixel_count) / combined,
          (match.rgb[2] * match.pixel_count + entry.rgb[2] * entry.pixel_count) / combined,
        ];
        match.pixel_count = combined;
        match.hex = rgbToHex(match.rgb);
      } else {
        merged.push({ ...entry });
      }
    });

    return merged
      .map((entry) => ({
        ...entry,
        rgb: entry.rgb.map((value) => Math.round(value)),
        hex: rgbToHex(entry.rgb),
        percent: totalPixels ? (entry.pixel_count / totalPixels) * 100 : 0,
      }))
      .sort((a, b) => b.percent - a.percent);
  }

  function initDesigner($root) {
    const $categories = $root.find('.mockmaster-designer__category');
    const $panels = $root.find('.mockmaster-designer__panel');
    const $swatches = $root.find('[data-role="color-options"]');
    const $quantityOptions = $root.find('[data-role="quantity-options"]');
    const $baseImage = $root.find('.mockmaster-designer__base-image');
    const $designImage = $root.find('.mockmaster-designer__design-image');
    const $uploadInput = $root.find('.mockmaster-designer__upload-input');
    const $uploadList = $root.find('[data-role="design-uploads"]');
    const $colorCounter = $root.find('[data-role="color-counter"]');
    const $colorCount = $root.find('[data-role="color-count"]');
    const $colorPalette = $root.find('[data-role="color-palette"]');
    const $colorPreview = $root.find('[data-role="color-preview"]');
    const $colorCountInput = $root.find('[data-role="color-count-input"]');
    const $colorPaletteInput = $root.find('[data-role="color-palette-input"]');
    const $colorSettingsInput = $root.find('[data-role="color-settings-input"]');
    const $colorCountControl = $root.find('[data-role="color-count-control"]');
    const $colorMinPct = $root.find('[data-role="color-min-pct"]');
    const $colorAlpha = $root.find('[data-role="color-alpha-threshold"]');
    const $colorBackground = $root.find('[data-role="color-background"]');
    const $colorComposite = $root.find('[data-role="color-composite"]');
    let $selectQuantities = $root.find('[data-role="select-quantities"]');
    const $placeDesign = $root.find('[data-role="place-design"]');
    const $altViewButtons = $root.find('.mockmaster-designer__alt-view');
    const $placementButtons = $root.find('.mockmaster-designer__placement-options button');
    const $placementStatus = $root.find('[data-role="placement-status"]');
    const $placementSize = $root.find('[data-role="placement-size"]');
    const $placementDimensions = $root.find('[data-role="placement-dimensions"]');
    const $placementSave = $root.find('[data-role="placement-save"]');
    const $stage = $root.find('.mockmaster-designer__image-stage');
    const savedDesigns = [];
    let isDragging = false;
    const dragNamespace = `.mockmasterDesigner${Math.random().toString(36).slice(2)}`;
    const sideImage = data.ColorDirectSideImage || data.colorSideImage || '';
    let currentView = 'front';
    let currentColorImage = '';
    let currentDesignName = '';
    let currentPlacement = null;
    let currentPlacementSize = null;
    let isPlacementLocked = false;
    let currentDesignPosition = null;
    const fallbackViewImages = {
      front: '',
      left: sideImage,
      back: data.colorBackImage || '',
      right: sideImage,
    };
    const colorDefaults = data.colorCounterDefaults || {};
    let lastColorCounterCanvas = null;
    let lastColorCounterFile = null;
    let currentColorPalette = [];
    let isColorCounterVisible = false;

    function deriveViewUrls(frontUrl) {
      if (!frontUrl) {
        return null;
      }
      const match = frontUrl.match(/_f_fm\.(jpg|jpeg|png)$/i);
      if (!match) {
        return null;
      }
      const extension = match[1];
      const base = frontUrl.replace(/_f_fm\.(jpg|jpeg|png)$/i, '');
      return {
        front: frontUrl,
        back: `${base}_b_fm.${extension}`,
        leftPrimary: `${base}_d_fm.${extension}`,
        leftFallback: `${base}_fm.${extension}`,
      };
    }

    function applyImageWithFallback($image, primary, fallback) {
      if (!primary) {
        return;
      }

      $image.off('error.mockmaster').on('error.mockmaster', function () {
        if (fallback && $image.attr('src') !== fallback) {
          $image.attr('src', fallback);
        }
      });

      $image.attr('src', primary);
    }

    function updatePlacementStatus() {
      if (!$placementStatus.length) {
        return;
      }

      $placementStatus.text(currentDesignName ? currentDesignName : 'None');
    }

    function getDesignAspectRatio() {
      const image = $designImage.get(0);
      if (image && image.naturalWidth && image.naturalHeight) {
        return image.naturalWidth / image.naturalHeight;
      }
      return 1;
    }

    function getPlacementSizeConfig(placement) {
      return placements[placement] ? placements[placement].size : null;
    }

    function getPlacementSizeBounds(placement) {
      const config = getPlacementSizeConfig(placement);
      if (!config) {
        return null;
      }

      const aspect = getDesignAspectRatio();
      const max =
        config.max ??
        (aspect >= 1 ? config.maxWidth ?? config.default : config.maxHeight ?? config.default);
      const min =
        config.min && aspect < 1 && config.min === 2 && config.maxWidth && config.maxHeight
          ? Math.max(config.min / aspect, config.min)
          : config.min;

      return {
        min,
        max,
        default: config.default,
      };
    }

    function updatePlacementSlider(placement) {
      if (!$placementSize.length) {
        return;
      }

      const bounds = getPlacementSizeBounds(placement);
      if (!bounds) {
        return;
      }

      const nextSize = currentPlacementSize ?? bounds.default;
      const clampedSize = Math.min(bounds.max, Math.max(bounds.min, nextSize));
      currentPlacementSize = clampedSize;
      $placementSize.attr({
        min: bounds.min,
        max: bounds.max,
        step: 0.1,
      });
      $placementSize.val(clampedSize);
    }

    function getPlacementDimensionsText(placement, sizeOverride) {
      if (!placement) {
        return '--';
      }

      const sizeConfig = getPlacementSizeConfig(placement);
      if (!sizeConfig) {
        return '--';
      }

      const size = sizeOverride ?? currentPlacementSize ?? sizeConfig.default;
      const aspect = getDesignAspectRatio();
      let width = size;
      let height = size;

      if (aspect >= 1) {
        width = size;
        height = size / aspect;
      } else {
        height = size;
        width = size * aspect;
      }

      return `Approx. size: ${width.toFixed(1)}" W x ${height.toFixed(1)}" H`;
    }

    function applyPlacement(placement) {
      const placementData = placements[placement];
      if (!placementData) {
        return;
      }

      const baseWidth = parseFloat(placementData.width);
      const sizeConfig = getPlacementSizeConfig(placement);
      const targetSize = currentPlacementSize ?? (sizeConfig ? sizeConfig.default : null);
      const sizeRatio = sizeConfig && targetSize ? targetSize / sizeConfig.default : 1;
      const scaledWidth = Number.isNaN(baseWidth) ? placementData.width : `${baseWidth * sizeRatio}%`;

      $designImage.css({
        top: placementData.top,
        left: placementData.left,
        width: scaledWidth,
        transform: 'translate(-50%, -50%)',
      });
    }

    function getScaledPlacementWidthPercent(placement, sizeOverride) {
      const placementData = placements[placement];
      if (!placementData) {
        return null;
      }

      const baseWidth = parseFloat(placementData.width);
      const sizeConfig = getPlacementSizeConfig(placement);
      const targetSize = sizeOverride ?? currentPlacementSize ?? (sizeConfig ? sizeConfig.default : null);
      const sizeRatio = sizeConfig && targetSize ? targetSize / sizeConfig.default : 1;
      const scaledValue = Number.isNaN(baseWidth) ? null : baseWidth * sizeRatio;
      return scaledValue ? Math.max(0, Math.min(100, scaledValue)) : null;
    }

    function getDesignPositionPercent() {
      const stageWidth = $stage.outerWidth() || 0;
      const stageHeight = $stage.outerHeight() || 0;
      const leftValue = $designImage.css('left') || '0';
      const topValue = $designImage.css('top') || '0';
      const leftIsPercent = leftValue.includes('%');
      const topIsPercent = topValue.includes('%');
      const leftNumber = parseFloat(leftValue) || 0;
      const topNumber = parseFloat(topValue) || 0;

      const leftPercent =
        leftIsPercent || !stageWidth ? leftNumber : Math.min(100, Math.max(0, (leftNumber / stageWidth) * 100));
      const topPercent =
        topIsPercent || !stageHeight ? topNumber : Math.min(100, Math.max(0, (topNumber / stageHeight) * 100));

      return {
        left: leftPercent,
        top: topPercent,
      };
    }

    function formatPositionText(position) {
      if (!position) {
        return 'Position: --';
      }

      return `Position: ${position.left.toFixed(1)}% L, ${position.top.toFixed(1)}% T`;
    }

    function applyDesignPosition(position) {
      if (!position) {
        return;
      }

      $designImage.css({
        left: `${position.left}%`,
        top: `${position.top}%`,
        transform: 'translate(-50%, -50%)',
      });
    }

    function updatePlacementDimensions() {
      if (!$placementDimensions.length || !currentPlacement) {
        return;
      }

      $placementDimensions.text(getPlacementDimensionsText(currentPlacement));
    }

    function setDesignImageVisibility(isVisible) {
      $designImage.toggleClass('is-hidden', !isVisible);
      renderStageOverlays();
    }

    function ensureStageOverlayContainer() {
      let $overlayContainer = $stage.find('.mockmaster-designer__stage-overlays');
      if (!$overlayContainer.length) {
        $overlayContainer = $('<div class="mockmaster-designer__stage-overlays" aria-hidden="true"></div>');
        $stage.append($overlayContainer);
      }
      return $overlayContainer;
    }

    function renderStageOverlays() {
      const $overlayContainer = ensureStageOverlayContainer();
      $overlayContainer.empty();

      const stageWidth = $stage.outerWidth() || 0;
      const stageHeight = $stage.outerHeight() || 0;
      if (!stageWidth || !stageHeight) {
        return;
      }

      const shouldHideCurrentDesign = $designImage.attr('src') && !$designImage.hasClass('is-hidden');

      savedDesigns.forEach((entry) => {
        if (entry.view !== currentView || !entry.src) {
          return;
        }
        if (entry.name === currentDesignName && shouldHideCurrentDesign) {
          return;
        }

        const position = entry.position || { left: 50, top: 50 };
        const widthPercent = entry.widthPercent || 0;
        const widthPx = (widthPercent / 100) * stageWidth;

        const $overlay = $('<img class="mockmaster-designer__stage-overlay" alt="" />');
        $overlay.attr('src', entry.src);
        $overlay.css({
          left: `${position.left}%`,
          top: `${position.top}%`,
          width: `${widthPx}px`,
        });
        $overlayContainer.append($overlay);
      });
    }

    function setPlacementLockState() {
      const locked = isPlacementLocked;
      $placementButtons.prop('disabled', locked);
      $placementSize.prop('disabled', locked);
      $designImage.toggleClass('is-locked', locked);

      if ($placementSave.length) {
        $placementSave.prop('disabled', locked);
        $placementSave.text(locked ? 'Saved' : 'Save placement');
      }
    }

    function updatePlacementAvailability() {
      const usedPlacements = savedDesigns
        .filter((entry) => entry.name !== currentDesignName)
        .map((entry) => entry.placement);

      $placementButtons.each(function () {
        const $button = $(this);
        const placement = $button.data('placement');
        const isUsed = usedPlacements.includes(placement);
        $button.prop('disabled', isUsed || isPlacementLocked);
        $button.toggleClass('is-disabled', isUsed);
      });
    }

    function renderSavedDesigns() {
      if (!$uploadList.length) {
        return;
      }

      if (!savedDesigns.length) {
        $uploadList.html('<li>No saved placements yet.</li>');
        updateSelectQuantitiesButton();
        return;
      }

      const listItems = savedDesigns
        .map((entry) => {
          return `
            <li class="mockmaster-designer__upload-item">
              <div>
                <span class="mockmaster-designer__upload-name">${entry.name}</span>
                <span class="mockmaster-designer__upload-meta">${entry.placementLabel} · ${entry.dimensions} · ${formatPositionText(entry.position)}</span>
              </div>
              <div class="mockmaster-designer__upload-actions">
                <button type="button" class="mockmaster-designer__upload-edit" data-design="${entry.name}">Edit</button>
                <button type="button" class="mockmaster-designer__upload-remove" data-design="${entry.name}">Remove</button>
              </div>
            </li>
          `;
        })
        .join('');

      $uploadList.html(listItems);
      updateSelectQuantitiesButton();
      updatePlaceDesignButton();
      updatePlacementAvailability();
    }

    function updateSelectQuantitiesButton() {
      if (!$selectQuantities.length) {
        const $designPanel = $panels.filter('[data-panel="design"]');
        if ($designPanel.length) {
          $selectQuantities = $('<button type="button" class="mockmaster-designer__select-quantities is-hidden" data-role="select-quantities">Select Quantities</button>');
          $designPanel.append($selectQuantities);
        } else {
          return;
        }
      }

      const hasUploads = $uploadList.find('.mockmaster-designer__upload-item').length > 0;
      $selectQuantities.toggleClass('is-hidden', !hasUploads);
    }

    function updatePlaceDesignButton() {
      if (!$placeDesign.length) {
        return;
      }
      const hasDesign = Boolean($designImage.attr('src'));
      $placeDesign.toggleClass('is-hidden', !hasDesign);
    }

    function updateColorCounterVisibility() {
      if (!$colorCounter.length) {
        return;
      }
      const hasDesign = Boolean($designImage.attr('src'));
      $colorCounter.toggleClass('is-hidden', !(hasDesign && isColorCounterVisible));
    }

    function switchPanel(category) {
      $categories.removeClass('is-active');
      $categories.filter(`[data-category="${category}"]`).addClass('is-active');

      $panels.removeClass('is-active');
      $panels.filter(`[data-panel="${category}"]`).addClass('is-active');

      if (category === 'design') {
        updateSelectQuantitiesButton();
        updatePlaceDesignButton();
        updateColorCounterVisibility();
      }

      if (category === 'placement') {
        setDesignImageVisibility(true);
      }
    }

    function isPlacementPanelActive() {
      return $panels.filter('[data-panel="placement"]').hasClass('is-active');
    }

    function getViewForPlacement(placement) {
      if (placement === 'left-sleeve') {
        return 'left';
      }
      if (placement === 'right-sleeve') {
        return 'right';
      }
      if (placement === 'back') {
        return 'back';
      }
      return 'front';
    }

    function setViewForPlacement(placement) {
      const nextView = getViewForPlacement(placement);
      currentView = nextView;
      $altViewButtons.removeClass('is-active');
      $altViewButtons.filter(`[data-view="${nextView}"]`).addClass('is-active');
      setBaseImageForView(nextView);
      setAltViewButtonImages();
      renderStageOverlays();
    }

    function setBaseImageForView(view) {
      const frontUrl = currentColorImage || data.defaultImage || '';
      const viewUrls = deriveViewUrls(frontUrl);
      const fallbackImage = frontUrl || '';

      if (viewUrls) {
        if (view === 'back') {
          applyImageWithFallback($baseImage, viewUrls.back, fallbackImage);
        } else if (view === 'left' || view === 'right') {
          applyImageWithFallback($baseImage, viewUrls.leftPrimary, viewUrls.leftFallback || fallbackImage);
        } else {
          applyImageWithFallback($baseImage, viewUrls.front, fallbackImage);
        }
      } else {
        const fallbackViewImage = fallbackViewImages[view] || fallbackImage;
        applyImageWithFallback($baseImage, fallbackViewImage, fallbackImage);
      }

      if (view === 'right') {
        $baseImage.addClass('is-flipped');
      } else {
        $baseImage.removeClass('is-flipped');
      }

      renderStageOverlays();
    }

    function setAltViewButtonImages() {
      const stageWidth = $stage.outerWidth() || 0;
      const thumbnailWidth = stageWidth ? stageWidth / 4 : 0;
      const frontUrl = currentColorImage || data.defaultImage || '';
      const viewUrls = deriveViewUrls(frontUrl);
      const fallbackImage = frontUrl || '';

      $altViewButtons.each(function () {
        const $button = $(this);
        const view = $button.data('view');
        const $image = $button.find('.mockmaster-designer__alt-view-image');
        let viewImage = fallbackViewImages[view] || fallbackImage;
        let fallbackForView = fallbackImage;

        if (viewUrls) {
          if (view === 'back') {
            viewImage = viewUrls.back;
          } else if (view === 'left' || view === 'right') {
            viewImage = viewUrls.leftPrimary;
            fallbackForView = viewUrls.leftFallback || fallbackImage;
          } else if (view === 'front') {
            viewImage = viewUrls.front;
          } else {
            viewImage = viewUrls.front;
          }
        }

        if (viewImage) {
          applyImageWithFallback($image, viewImage, fallbackForView);
        }

        if (thumbnailWidth) {
          $image.css('width', `${thumbnailWidth}px`);
        }

        if (view === 'right' && viewImage) {
          $image.addClass('is-flipped');
        } else {
          $image.removeClass('is-flipped');
        }
      });

      renderAltViewOverlays();
      renderStageOverlays();
    }

    function renderAltViewOverlays() {
      $altViewButtons.each(function () {
        const $button = $(this);
        const view = $button.data('view');
        const $image = $button.find('.mockmaster-designer__alt-view-image');
        const $existingOverlays = $button.find('.mockmaster-designer__alt-view-overlay');
        $existingOverlays.remove();

        const imageWidth = $image.width() || 0;
        const imageHeight = $image.height() || 0;
        const imageOffset = $image.position() || { left: 0, top: 0 };

        if (!imageWidth || !imageHeight) {
          return;
        }

        savedDesigns.forEach((entry) => {
          if (entry.view !== view || !entry.src) {
            return;
          }

          const position = entry.position || { left: 50, top: 50 };
          const widthPercent = entry.widthPercent || 0;
          const leftPx = imageOffset.left + (position.left / 100) * imageWidth;
          const topPx = imageOffset.top + (position.top / 100) * imageHeight;
          const widthPx = (widthPercent / 100) * imageWidth;
          const $overlay = $('<img class="mockmaster-designer__alt-view-overlay" alt="" />');

          $overlay.attr('src', entry.src);
          $overlay.css({
            left: `${leftPx}px`,
            top: `${topPx}px`,
            width: `${widthPx}px`,
          });
          $button.append($overlay);
        });
      });
    }

    function renderColors() {
      const colors = data.colors || {};
      const entries = Object.keys(colors);

      if (!entries.length) {
        $swatches.html('<span>No colors available</span>');
        return;
      }

      const html = entries
        .map((key, index) => {
          const color = colors[key];
          const activeClass = index === 0 ? 'is-active' : '';
          const label = color.label || key;
          const labelText = String(label).toUpperCase();
          const swatchImage = color.swatch;
          const styleAttr = swatchImage ? `style="background-image: url('${swatchImage}');"` : '';
          const imageClass = swatchImage ? 'has-image' : '';
          return `
            <button type="button" class="mockmaster-designer__swatch ${activeClass} ${imageClass}" data-color="${key}" data-label="${labelText}" ${styleAttr} aria-label="${label}"></button>
          `;
        })
        .join('');

      $swatches.html(html);
      const firstKey = entries[0];
      if (firstKey && colors[firstKey] && colors[firstKey].image) {
        currentColorImage = colors[firstKey].image;
        setBaseImageForView(currentView);
      }

      setAltViewButtonImages();
      renderQuantities(firstKey);
    }

    function renderQuantities(colorKey) {
      const variations = data.variations || {};
      const sizes = variations[colorKey] ? variations[colorKey].sizes : {};
      const sizeKeys = sizes ? Object.keys(sizes) : [];

      if (!sizeKeys.length) {
        $quantityOptions.html('<span>No sizes available</span>');
        return;
      }

      const rows = sizeKeys
        .map((size) => {
          const sizeData = sizes[size];
          const sizeLabel = String(sizeData.label || size).toUpperCase();
          return `
            <div class="mockmaster-designer__quantity-row">
              <span>${sizeLabel}</span>
              <span>In stock: ${sizeData.stock}</span>
              <input type="number" min="0" placeholder="0" />
            </div>
          `;
        })
        .join('');

      $quantityOptions.html(rows);
    }

    updateColorCounterControls();

    if ($colorCounter.length) {
      $colorCounter.on('input change', 'input, select', function () {
        if ($(this).data('role') === 'color-swatch-input') {
          return;
        }
        if (lastColorCounterCanvas) {
          analyzeImageColors(lastColorCounterCanvas);
        }
      });
    }

    function getColorCounterSettings() {
      const colorCountValue = parseInt($colorCountControl.val(), 10);
      const minPctValue = parseFloat($colorMinPct.val());
      const alphaValue = parseInt($colorAlpha.val(), 10);
      const compositeValue = String($colorComposite.val()) === '1';

      const defaultCount = colorDefaults.color_count || colorDefaults.k || 8;
      const colorCount = Number.isNaN(colorCountValue) ? defaultCount : colorCountValue;

      return {
        color_count: Math.min(8, Math.max(1, colorCount)),
        k: Math.min(8, Math.max(1, colorCount)),
        min_pct: Number.isNaN(minPctValue) ? colorDefaults.min_pct || 0.5 : minPctValue,
        min_pixels: colorDefaults.min_pixels || 0,
        alpha_threshold: Number.isNaN(alphaValue) ? colorDefaults.alpha_threshold || 20 : alphaValue,
        background: $colorBackground.val() || colorDefaults.background || '#ffffff',
        composite: compositeValue,
        max_working_dim: colorDefaults.max_working_dim || COLOR_COUNTER_CONFIG.MAX_WORKING_DIM,
        max_preview_dim: colorDefaults.max_preview_dim || COLOR_COUNTER_CONFIG.MAX_PREVIEW_DIM,
        max_samples: colorDefaults.max_samples || COLOR_COUNTER_CONFIG.MAX_SAMPLES,
        seed: colorDefaults.seed || COLOR_COUNTER_CONFIG.DEFAULT_SEED,
        merge_distance: colorDefaults.merge_distance || COLOR_COUNTER_CONFIG.DEFAULT_MERGE_DISTANCE,
      };
    }

    function updateColorCounterControls() {
      if (!$colorCounter.length) {
        return;
      }

      if (colorDefaults.color_count || colorDefaults.k) {
        $colorCountControl.val(colorDefaults.color_count || colorDefaults.k);
      }
      if (typeof colorDefaults.min_pct !== 'undefined') {
        $colorMinPct.val(colorDefaults.min_pct);
      }
      if (typeof colorDefaults.alpha_threshold !== 'undefined') {
        $colorAlpha.val(colorDefaults.alpha_threshold);
      }
      if (colorDefaults.background) {
        $colorBackground.val(colorDefaults.background);
      }
      if (typeof colorDefaults.composite !== 'undefined') {
        $colorComposite.val(colorDefaults.composite ? '1' : '0');
      }
    }

    function renderPalette(palette) {
      if (!$colorPalette.length) {
        return;
      }

      if (!palette.length) {
        $colorPalette.html('<span class="mockmaster-designer__color-counter-empty">No colors detected.</span>');
        return;
      }

      const items = palette
        .map((entry, index) => {
          const percent = entry.percent.toFixed(2);
          const hexValue = normalizeHexColor(entry.hex);
          return `
            <div class="mockmaster-designer__color-counter-swatch" data-index="${index}">
              <label class="mockmaster-designer__color-counter-color-picker">
                <span class="mockmaster-designer__color-counter-color" style="background:${hexValue}"></span>
                <input type="color" value="${hexValue.toLowerCase()}" data-role="color-swatch-input" data-index="${index}" />
              </label>
              <div class="mockmaster-designer__color-counter-meta">
                <span>${hexValue}</span>
                <span>${percent}%</span>
              </div>
            </div>
          `;
        })
        .join('');

      $colorPalette.html(items);
    }

    function renderQuantizedPreview(workingCanvas, palette, settings) {
      const previewCanvasElement = $colorPreview.get(0);
      const canvas = previewCanvasElement || document.createElement('canvas');

      const previewContext = canvas.getContext('2d');
      if (!previewContext) {
        return null;
      }

      if (!palette.length) {
        previewContext.clearRect(0, 0, canvas.width, canvas.height);
        return null;
      }

      const previewCanvas = createPreviewCanvasFromWorkingCanvas(workingCanvas, settings.max_preview_dim);
      if (!previewCanvas) {
        return null;
      }

      canvas.width = previewCanvas.width;
      canvas.height = previewCanvas.height;
      previewContext.clearRect(0, 0, canvas.width, canvas.height);
      const previewData = previewCanvas.getContext('2d').getImageData(0, 0, previewCanvas.width, previewCanvas.height);
      const data = previewData.data;
      const centroids = palette.map((entry) => entry.rgb);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const alpha = data[i + 3];
        if (alpha === 0 || alpha < settings.alpha_threshold) {
          data[i + 3] = 0;
          continue;
        }
        let nearest = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;

        for (let c = 0; c < centroids.length; c += 1) {
          const centroid = centroids[c];
          const dr = r - centroid[0];
          const dg = g - centroid[1];
          const db = b - centroid[2];
          const distance = dr * dr + dg * dg + db * db;
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = c;
          }
        }

        data[i] = centroids[nearest][0];
        data[i + 1] = centroids[nearest][1];
        data[i + 2] = centroids[nearest][2];
        data[i + 3] = alpha;
      }

      previewContext.putImageData(previewData, 0, 0);
      return canvas.toDataURL('image/png');
    }

    function updateColorCounterOutputs(result, settings) {
      if (!$colorCounter.length) {
        return;
      }

      const palette = result.palette || [];
      const estimated = result.final_color_count || 0;

      $colorCount.text(typeof estimated === 'number' ? String(estimated) : '--');
      currentColorPalette = palette.map((entry) => ({ ...entry }));
      renderPalette(currentColorPalette);

      $colorCountInput.val(estimated);
      $colorPaletteInput.val(JSON.stringify(palette));
      $colorSettingsInput.val(JSON.stringify(settings));

      if (data.ajaxUrl && data.colorCounterNonce) {
        $.post(data.ajaxUrl, {
          action: 'mockmaster_designer_store_color_count',
          nonce: data.colorCounterNonce,
          estimated_colors: estimated,
          palette: JSON.stringify(palette),
          settings: JSON.stringify(settings),
        });
      }
    }

    function buildWorkingCanvasForFile(file) {
      const settings = getColorCounterSettings();
      const maxWorkingDim = settings.max_working_dim;

      if (isSvgFile(file)) {
        return buildWorkingCanvasFromSvg(file, maxWorkingDim);
      }

      return buildWorkingCanvasFromRaster(file, maxWorkingDim);
    }

    function analyzeImageColors(workingCanvas) {
      const settings = getColorCounterSettings();
      if (!workingCanvas) {
        return;
      }
      const context = workingCanvas.getContext('2d');
      if (!context) {
        return;
      }

      // Quantization + noise filtering approximates screen print separations by grouping similar colors and removing tiny blends.
      const imageData = context.getImageData(0, 0, workingCanvas.width, workingCanvas.height);
      const pixels = samplePixels(imageData, {
        alphaThreshold: settings.alpha_threshold,
        compositeOnBackground: settings.composite,
        backgroundRgb: parseHexColor(settings.background),
        maxSamples: settings.max_samples,
      });

      if (!pixels.length) {
        updateColorCounterOutputs({ final_color_count: 0, palette: [] }, settings);
        return;
      }

      const { centroids, assignments } = kMeansQuantize(pixels, settings.k, settings.seed);
      const rawPalette = buildPalette(
        centroids,
        assignments,
        pixels.length,
        settings.min_pct,
        settings.min_pixels
      );
      const palette = mergePaletteByDistance(rawPalette, pixels.length, settings.merge_distance);

      const result = {
        final_color_count: palette.length,
        palette,
      };

      updateColorCounterOutputs(result, settings);
      const previewDataUrl = renderQuantizedPreview(workingCanvas, palette, settings);
      if (previewDataUrl && $designImage.length) {
        $designImage.attr('src', previewDataUrl);
        $designImage.addClass('is-visible');
        setDesignImageVisibility(true);
      }
    }

    $root.on('input change', '[data-role="color-swatch-input"]', function () {
      const index = parseInt($(this).data('index'), 10);
      if (Number.isNaN(index) || !currentColorPalette[index]) {
        return;
      }
      const nextHex = normalizeHexColor($(this).val());
      const nextRgb = parseHexColor(nextHex);
      currentColorPalette[index] = {
        ...currentColorPalette[index],
        hex: nextHex,
        rgb: nextRgb,
      };
      const $swatch = $colorPalette.find(`.mockmaster-designer__color-counter-swatch[data-index="${index}"]`);
      $swatch.find('.mockmaster-designer__color-counter-color').css('background', nextHex);
      $swatch.find('.mockmaster-designer__color-counter-meta span').first().text(nextHex);
      $colorPaletteInput.val(JSON.stringify(currentColorPalette));
      if (data.ajaxUrl && data.colorCounterNonce) {
        $.post(data.ajaxUrl, {
          action: 'mockmaster_designer_store_color_count',
          nonce: data.colorCounterNonce,
          estimated_colors: currentColorPalette.length,
          palette: JSON.stringify(currentColorPalette),
          settings: JSON.stringify(getColorCounterSettings()),
        });
      }
      if (lastColorCounterCanvas) {
        const settings = getColorCounterSettings();
        const previewDataUrl = renderQuantizedPreview(lastColorCounterCanvas, currentColorPalette, settings);
        if (previewDataUrl && $designImage.length) {
          $designImage.attr('src', previewDataUrl);
          $designImage.addClass('is-visible');
          setDesignImageVisibility(true);
        }
      }
    });

    $root.on('click', '.mockmaster-designer__category', function () {
      const category = $(this).data('category');
      $categories.removeClass('is-active');
      $(this).addClass('is-active');

      $panels.removeClass('is-active');
      $panels.filter(`[data-panel="${category}"]`).addClass('is-active');
    });

    $root.on('click', '.mockmaster-designer__swatch', function () {
      const colorKey = $(this).data('color');
      $swatches.find('.mockmaster-designer__swatch').removeClass('is-active');
      $(this).addClass('is-active');

      const color = data.colors && data.colors[colorKey];
      if (color && color.image) {
        currentColorImage = color.image;
        setBaseImageForView(currentView);
      }
      $baseImage.removeClass('is-flipped');
      $altViewButtons.removeClass('is-active');

      setAltViewButtonImages();
      renderQuantities(colorKey);
      switchPanel('design');
    });

    $uploadInput.on('change', function (event) {
      const file = event.target.files[0];
      if (!file) {
        return;
      }

      currentDesignName = file.name;
      currentPlacement = null;
      currentPlacementSize = null;
      isPlacementLocked = false;
      currentDesignPosition = null;
      updatePlacementStatus();
      setPlacementLockState();
      $placementButtons.removeClass('is-active');
      updatePlacementAvailability();
      $placementDimensions.text('--');
      if ($uploadList.length) {
        renderSavedDesigns();
      }

      const reader = new FileReader();
      reader.onload = function (loadEvent) {
        $designImage.attr('src', loadEvent.target.result);
        $designImage.addClass('is-visible');
        setDesignImageVisibility(true);
        updatePlaceDesignButton();
        isColorCounterVisible = true;
        updateColorCounterVisibility();

        if ($colorCounter.length) {
          lastColorCounterFile = file;
          buildWorkingCanvasForFile(file)
            .then(({ canvas }) => {
              lastColorCounterCanvas = canvas;
              analyzeImageColors(canvas);
            })
            .catch(() => {
              updateColorCounterOutputs({ final_color_count: 0, palette: [] }, getColorCounterSettings());
            });
        }
      };
      reader.readAsDataURL(file);
    });

    $designImage.on('load', function () {
      if (currentPlacement) {
        updatePlacementSlider(currentPlacement);
        applyPlacement(currentPlacement);
        updatePlacementDimensions();
      }
    });

    $designImage.on('mousedown', function (event) {
      if (!$designImage.attr('src')) {
        return;
      }
      if (!isPlacementPanelActive()) {
        return;
      }
      if (isPlacementLocked) {
        return;
      }

      isDragging = true;
      event.preventDefault();
    });

    $(document).on(`mousemove${dragNamespace}`, function (event) {
      if (!isDragging || isPlacementLocked) {
        return;
      }
      if (!isPlacementPanelActive()) {
        return;
      }

      const stageOffset = $stage.offset();
      if (!stageOffset) {
        return;
      }

      const stageWidth = $stage.outerWidth();
      const stageHeight = $stage.outerHeight();
      let x = event.pageX - stageOffset.left;
      let y = event.pageY - stageOffset.top;

      x = Math.max(0, Math.min(stageWidth, x));
      y = Math.max(0, Math.min(stageHeight, y));

      $designImage.css({
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -50%)',
      });
    });

    $(document).on(`mouseup${dragNamespace}`, function () {
      if (isDragging) {
        isDragging = false;
      }
    });

    $root.on('click', '.mockmaster-designer__placement-options button', function () {
      const placement = $(this).data('placement');
      $placementButtons.removeClass('is-active');
      $(this).addClass('is-active');

      currentPlacement = placement;
      currentPlacementSize = null;
      currentDesignPosition = null;
      updatePlacementSlider(placement);
      applyPlacement(placement);
      updatePlacementDimensions();
      setViewForPlacement(placement);
    });

    $placementSize.on('input change', function () {
      const value = parseFloat($(this).val());
      if (Number.isNaN(value)) {
        return;
      }

      currentPlacementSize = value;
      if (currentPlacement) {
        applyPlacement(currentPlacement);
        updatePlacementDimensions();
      }
    });

    $placementSave.on('click', function () {
      if (!currentDesignName || !currentPlacement) {
        $placementStatus.text('Select a design and placement before saving.');
        return;
      }

      currentDesignPosition = getDesignPositionPercent();
      const sizeConfig = getPlacementSizeConfig(currentPlacement);
      const size = currentPlacementSize ?? (sizeConfig ? sizeConfig.default : null);
      const placementLabel = placementLabels[currentPlacement] || currentPlacement;
      const dimensions = getPlacementDimensionsText(currentPlacement, size);
      const widthPercent = getScaledPlacementWidthPercent(currentPlacement, size);
      const designSrc = $designImage.attr('src');
      const overlayView = getViewForPlacement(currentPlacement);
      const existingIndex = savedDesigns.findIndex((entry) => entry.name === currentDesignName);
      const nextEntry = {
        name: currentDesignName,
        placement: currentPlacement,
        placementLabel,
        size,
        dimensions,
        position: currentDesignPosition,
        widthPercent,
        view: overlayView,
        src: designSrc,
      };

      if (existingIndex >= 0) {
        savedDesigns[existingIndex] = nextEntry;
      } else {
        savedDesigns.push(nextEntry);
      }

      isPlacementLocked = true;
      setPlacementLockState();
      isColorCounterVisible = false;
      renderSavedDesigns();
      renderAltViewOverlays();
      switchPanel('design');
      updateSelectQuantitiesButton();
      updateColorCounterVisibility();
      updatePlacementAvailability();
      renderStageOverlays();
    });

    $root.on('click', '[data-role="select-quantities"]', function () {
      switchPanel('quantities');
    });

    $root.on('click', '[data-role="place-design"]', function () {
      switchPanel('placement');
    });

    $root.on('click', '.mockmaster-designer__upload-edit', function () {
      const designName = $(this).data('design');
      const entry = savedDesigns.find((saved) => saved.name === designName);
      if (!entry) {
        return;
      }

      currentDesignName = entry.name;
      currentPlacement = entry.placement;
      currentPlacementSize = entry.size;
      currentDesignPosition = entry.position;
      isPlacementLocked = false;
      if (entry.src) {
        $designImage.attr('src', entry.src);
        $designImage.addClass('is-visible');
      }
      setDesignImageVisibility(true);
      updatePlacementStatus();
      setPlacementLockState();
      updatePlacementAvailability();
      isColorCounterVisible = true;
      updateColorCounterVisibility();

      $placementButtons.removeClass('is-active');
      $placementButtons.filter(`[data-placement="${entry.placement}"]`).addClass('is-active');
      updatePlacementSlider(entry.placement);
      applyPlacement(entry.placement);
      applyDesignPosition(entry.position);
      updatePlacementDimensions();
      setViewForPlacement(entry.placement);
      renderAltViewOverlays();
      renderStageOverlays();

      $categories.removeClass('is-active');
      $categories.filter('[data-category="placement"]').addClass('is-active');
      $panels.removeClass('is-active');
      $panels.filter('[data-panel="placement"]').addClass('is-active');
    });

    $root.on('click', '.mockmaster-designer__upload-remove', function () {
      const designName = $(this).data('design');
      const entryIndex = savedDesigns.findIndex((saved) => saved.name === designName);
      if (entryIndex === -1) {
        return;
      }

      const removedEntry = savedDesigns[entryIndex];
      savedDesigns.splice(entryIndex, 1);

      if (currentDesignName === removedEntry.name) {
        currentDesignName = '';
        currentPlacement = null;
        currentPlacementSize = null;
        currentDesignPosition = null;
        isPlacementLocked = false;
        $designImage.removeAttr('src');
        $designImage.removeClass('is-visible');
        updatePlacementStatus();
        setPlacementLockState();
        $placementButtons.removeClass('is-active');
        $placementDimensions.text('--');
        updatePlaceDesignButton();
        isColorCounterVisible = false;
        updateColorCounterVisibility();
      }

      renderSavedDesigns();
      renderAltViewOverlays();
      updatePlacementAvailability();
      renderStageOverlays();
    });

    $root.on('click', '.mockmaster-designer__alt-view', function () {
      const view = $(this).data('view');
      $altViewButtons.removeClass('is-active');
      $(this).addClass('is-active');
      currentView = view;

      setBaseImageForView(view);
      setAltViewButtonImages();
      renderStageOverlays();
      setDesignImageVisibility(false);
    });

    $root.on('mockmaster:refresh-stage', function () {
      renderStageOverlays();
    });

    renderColors();
    setAltViewButtonImages();
    updatePlacementStatus();
    updateColorCounterVisibility();
    renderSavedDesigns();
    setPlacementLockState();
    renderStageOverlays();
  }

  $(document).ready(function () {
    $('.mockmaster-designer').each(function () {
      initDesigner($(this));
    });
  });

  $(window).on('resize', function () {
    $('.mockmaster-designer').each(function () {
      const $root = $(this);
      const $stage = $root.find('.mockmaster-designer__image-stage');
      const stageWidth = $stage.outerWidth() || 0;
      const thumbnailWidth = stageWidth ? stageWidth / 4 : 0;

      $root.find('.mockmaster-designer__alt-view-image').each(function () {
        const $image = $(this);
        if (thumbnailWidth) {
          $image.css('width', `${thumbnailWidth}px`);
        }
      });

      $root.trigger('mockmaster:refresh-stage');
    });
  });
})(jQuery);
