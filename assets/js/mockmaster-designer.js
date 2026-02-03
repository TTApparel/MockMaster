(function ($) {
  const data = window.MockMasterDesignerData || {};

  const placements = {
    'left-chest': { top: '32%', left: '38%', width: '22%' },
    'right-chest': { top: '32%', left: '56%', width: '22%' },
    'full-chest': { top: '34%', left: '50%', width: '42%' },
    'left-sleeve': { top: '40%', left: '22%', width: '18%' },
    'right-sleeve': { top: '40%', left: '78%', width: '18%' },
    back: { top: '38%', left: '50%', width: '40%' },
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
    const $altViewButtons = $root.find('.mockmaster-designer__alt-view');
    const $placementButtons = $root.find('.mockmaster-designer__placement-options button');
    const $stage = $root.find('.mockmaster-designer__image-stage');
    const uploadedDesigns = [];
    let isDragging = false;
    const dragNamespace = `.mockmasterDesigner${Math.random().toString(36).slice(2)}`;
    const sideImage = data.ColorDirectSideImage || data.colorSideImage || '';
    let currentView = 'front';
    let currentColorImage = '';
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
    });

    $uploadInput.on('change', function (event) {
      const file = event.target.files[0];
      if (!file) {
        return;
      }

      uploadedDesigns.push(file.name);
      if ($uploadList.length) {
        const listItems = uploadedDesigns.map((name) => `<li>${name}</li>`).join('');
        $uploadList.html(listItems);
      }

      const reader = new FileReader();
      reader.onload = function (loadEvent) {
        $designImage.attr('src', loadEvent.target.result);
        $designImage.addClass('is-visible');
      };
      reader.readAsDataURL(file);
    });

    $designImage.on('mousedown', function (event) {
      if (!$designImage.attr('src')) {
        return;
      }

      isDragging = true;
      event.preventDefault();
    });

    $(document).on(`mousemove${dragNamespace}`, function (event) {
      if (!isDragging) {
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

      const placementData = placements[placement];
      if (!placementData) {
        return;
      }

      $designImage.css({
        top: placementData.top,
        left: placementData.left,
        width: placementData.width,
        transform: 'translate(-50%, -50%)',
      });
    });

    $root.on('click', '.mockmaster-designer__alt-view', function () {
      const view = $(this).data('view');
      $altViewButtons.removeClass('is-active');
      $(this).addClass('is-active');
      currentView = view;

      setBaseImageForView(view);
      setAltViewButtonImages();
    });

    renderColors();
    setAltViewButtonImages();
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
    });
  });
})(jQuery);
