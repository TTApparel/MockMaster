<?php
/**
 * Plugin Name: MockMaster Designer
 * Description: Adds a mockup designer panel for WooCommerce product pages.
 * Version: 1.0.0
 * Author: MockMaster
 */

if (!defined('ABSPATH')) {
    exit;
}

class MockMasterDesigner {
    public function __construct() {
        add_action('wp_enqueue_scripts', array($this, 'enqueue_assets'));
        add_shortcode('mockmaster_designer', array($this, 'render_shortcode'));
    }

    public function enqueue_assets() {
        $plugin_url = plugin_dir_url(__FILE__);

        wp_enqueue_style(
            'mockmaster-designer',
            $plugin_url . 'assets/css/mockmaster-designer.css',
            array(),
            '1.0.0'
        );

        wp_enqueue_script(
            'mockmaster-designer',
            $plugin_url . 'assets/js/mockmaster-designer.js',
            array('jquery'),
            '1.0.0',
            true
        );

        $product = $this->get_current_product();
        $data = $this->build_product_data($product);

        wp_localize_script('mockmaster-designer', 'MockMasterDesignerData', $data);
    }

    public function render_shortcode() {
        $product = $this->get_current_product();
        $image_url = $product ? wp_get_attachment_image_url($product->get_image_id(), 'large') : '';

        ob_start();
        ?>
        <section class="mockmaster-designer" data-product-id="<?php echo esc_attr($product ? $product->get_id() : 0); ?>">
            <div class="mockmaster-designer__left">
                <div class="mockmaster-designer__arc mockmaster-designer__arc--left">
                    <button class="mockmaster-designer__category is-active" data-category="color">Color</button>
                    <button class="mockmaster-designer__category" data-category="design">Design</button>
                    <button class="mockmaster-designer__category" data-category="placement">Placement</button>
                    <button class="mockmaster-designer__category" data-category="quantities">Quantities</button>
                </div>
            </div>
            <div class="mockmaster-designer__center">
                <div class="mockmaster-designer__image-stage">
                    <?php if ($image_url) : ?>
                        <img class="mockmaster-designer__base-image" src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr($product ? $product->get_name() : 'Product'); ?>" />
                    <?php else : ?>
                        <div class="mockmaster-designer__placeholder">Add a product image</div>
                    <?php endif; ?>
                    <img class="mockmaster-designer__design-image" alt="Design preview" />
                </div>
                <div class="mockmaster-designer__alt-views">
                    <button type="button" class="mockmaster-designer__alt-view" data-view="left">Left</button>
                    <button type="button" class="mockmaster-designer__alt-view" data-view="back">Back</button>
                    <button type="button" class="mockmaster-designer__alt-view" data-view="right">Right</button>
                </div>
                <button type="button" class="mockmaster-designer__add-to-cart">Add to Cart</button>
            </div>
            <div class="mockmaster-designer__right">
                <div class="mockmaster-designer__arc mockmaster-designer__arc--right">
                    <div class="mockmaster-designer__panel is-active" data-panel="color">
                        <p class="mockmaster-designer__panel-title">Select color</p>
                        <div class="mockmaster-designer__swatches" data-role="color-options"></div>
                    </div>
                    <div class="mockmaster-designer__panel" data-panel="design">
                        <p class="mockmaster-designer__panel-title">Upload design</p>
                        <label class="mockmaster-designer__upload">
                            <input type="file" accept="image/*" class="mockmaster-designer__upload-input" />
                            <span>Choose image</span>
                        </label>
                    </div>
                    <div class="mockmaster-designer__panel" data-panel="placement">
                        <p class="mockmaster-designer__panel-title">Choose placement</p>
                        <div class="mockmaster-designer__placement-options">
                            <button type="button" data-placement="left-chest">Left Chest</button>
                            <button type="button" data-placement="right-chest">Right Chest</button>
                            <button type="button" data-placement="full-chest">Full Chest</button>
                            <button type="button" data-placement="left-sleeve">Left Sleeve</button>
                            <button type="button" data-placement="right-sleeve">Right Sleeve</button>
                            <button type="button" data-placement="back">Back</button>
                        </div>
                    </div>
                    <div class="mockmaster-designer__panel" data-panel="quantities">
                        <p class="mockmaster-designer__panel-title">Sizes & quantities</p>
                        <div class="mockmaster-designer__quantities" data-role="quantity-options"></div>
                    </div>
                </div>
            </div>
        </section>
        <?php
        return ob_get_clean();
    }

    private function get_current_product() {
        if (!function_exists('wc_get_product')) {
            return null;
        }

        $product_id = 0;
        if (is_product()) {
            $product_id = get_the_ID();
        }

        if (!$product_id) {
            return null;
        }

        return wc_get_product($product_id);
    }

    private function build_product_data($product) {
        $data = array(
            'colors' => array(),
            'variations' => array(),
            'sizes' => array(),
            'defaultImage' => '',
        );

        if (!$product || !($product instanceof WC_Product)) {
            return $data;
        }

        $data['defaultImage'] = wp_get_attachment_image_url($product->get_image_id(), 'large');

        if ($product->is_type('variable')) {
            $variations = $product->get_available_variations();
            foreach ($variations as $variation) {
                $attributes = $variation['attributes'];
                $color = isset($attributes['attribute_pa_color']) ? wc_sanitize_taxonomy_name($attributes['attribute_pa_color']) : '';
                $size = isset($attributes['attribute_pa_size']) ? wc_sanitize_taxonomy_name($attributes['attribute_pa_size']) : '';

                if ($color) {
                    $data['colors'][$color] = array(
                        'label' => $attributes['attribute_pa_color'],
                        'image' => $variation['image']['src'] ?? $data['defaultImage'],
                    );
                }

                if ($color && $size) {
                    $data['variations'][$color]['sizes'][$size] = array(
                        'label' => $attributes['attribute_pa_size'],
                        'stock' => $variation['max_qty'] ?? 0,
                    );
                }
            }
        } else {
            $data['colors']['default'] = array(
                'label' => 'Default',
                'image' => $data['defaultImage'],
            );
        }

        return $data;
    }
}

new MockMasterDesigner();
