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
    const $placementButtons = $root.find('.mockmaster-designer__placement-options button');

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
          return `<button type="button" class="mockmaster-designer__swatch ${activeClass}" data-color="${key}">${color.label || key}</button>`;
        })
        .join('');

      $swatches.html(html);
      const firstKey = entries[0];
      if (firstKey && colors[firstKey] && colors[firstKey].image) {
        $baseImage.attr('src', colors[firstKey].image);
      }

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
          return `
            <div class="mockmaster-designer__quantity-row">
              <span>${sizeData.label || size}</span>
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
        $baseImage.attr('src', color.image);
      }

      renderQuantities(colorKey);
    });

    $uploadInput.on('change', function (event) {
      const file = event.target.files[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = function (loadEvent) {
        $designImage.attr('src', loadEvent.target.result);
        $designImage.addClass('is-visible');
      };
      reader.readAsDataURL(file);
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

    renderColors();
  }

  $(document).ready(function () {
    $('.mockmaster-designer').each(function () {
      initDesigner($(this));
    });
  });
})(jQuery);
