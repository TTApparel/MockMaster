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

  function initDesigner($root) {
    const $categories = $root.find('.mockmaster-designer__category');
    const $panels = $root.find('.mockmaster-designer__panel');
    const $swatches = $root.find('[data-role="color-options"]');
    const $quantityOptions = $root.find('[data-role="quantity-options"]');
    const $baseImage = $root.find('.mockmaster-designer__base-image');
    const $designImage = $root.find('.mockmaster-designer__design-image');
    const $uploadInput = $root.find('.mockmaster-designer__upload-input');
    const $uploadList = $root.find('[data-role="design-uploads"]');
    let $selectQuantities = $root.find('[data-role="select-quantities"]');
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

    function switchPanel(category) {
      $categories.removeClass('is-active');
      $categories.filter(`[data-category="${category}"]`).addClass('is-active');

      $panels.removeClass('is-active');
      $panels.filter(`[data-panel="${category}"]`).addClass('is-active');

      if (category === 'design') {
        updateSelectQuantitiesButton();
      }

      if (category === 'placement') {
        setDesignImageVisibility(true);
      }
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
        switchPanel('placement');
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
      renderSavedDesigns();
      renderAltViewOverlays();
      switchPanel('design');
      updateSelectQuantitiesButton();
      updatePlacementAvailability();
      renderStageOverlays();
    });

    $root.on('click', '[data-role="select-quantities"]', function () {
      switchPanel('quantities');
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
