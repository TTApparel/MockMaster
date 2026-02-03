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
    private $settings_option = 'mockmaster_designer_settings';
    private $admin_page_slug = 'mockmaster-designer';

    public function __construct() {
        add_action('wp_enqueue_scripts', array($this, 'enqueue_assets'));
        add_shortcode('mockmaster_designer', array($this, 'render_shortcode'));

        if (is_admin()) {
            add_action('admin_menu', array($this, 'register_admin_page'));
            add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_assets'));
            add_action('admin_post_mockmaster_designer_save', array($this, 'handle_settings_save'));
        }
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

        wp_add_inline_style('mockmaster-designer', $this->build_css_variables());
        wp_localize_script('mockmaster-designer', 'MockMasterDesignerData', $data);
    }

    public function render_shortcode() {
        $product = $this->get_current_product();
        $image_url = $product ? wp_get_attachment_image_url($product->get_image_id(), 'large') : '';
        $style_attr = $this->get_css_variables_inline();

        ob_start();
        ?>
        <section class="mockmaster-designer" data-product-id="<?php echo esc_attr($product ? $product->get_id() : 0); ?>" style="<?php echo esc_attr($style_attr); ?>">
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
                        <ul class="mockmaster-designer__upload-list" data-role="design-uploads"></ul>
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

    public function register_admin_page() {
        add_menu_page(
            'MockMaster Designer',
            'MockMaster Designer',
            'manage_options',
            $this->admin_page_slug,
            array($this, 'render_admin_page'),
            'dashicons-admin-customizer',
            56
        );
    }

    public function enqueue_admin_assets($hook) {
        if ($hook !== 'toplevel_page_' . $this->admin_page_slug) {
            return;
        }

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

        $product = $this->get_preview_product();
        $data = $this->build_product_data($product);

        wp_add_inline_style('mockmaster-designer', $this->build_css_variables());
        wp_localize_script('mockmaster-designer', 'MockMasterDesignerData', $data);
    }

    public function render_admin_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        $settings = $this->get_settings();
        $products = $this->get_preview_products();
        $selected_product_id = $this->get_preview_product_id();
        $style_attr = $this->get_css_variables_inline();
        $product = $this->get_preview_product();
        $image_url = $product ? wp_get_attachment_image_url($product->get_image_id(), 'large') : '';
        $updated = isset($_GET['settings-updated']) && $_GET['settings-updated'] === 'true';

        ?>
        <div class="wrap">
            <h1>MockMaster Designer</h1>
            <?php if ($updated) : ?>
                <div class="notice notice-success is-dismissible">
                    <p>Settings updated.</p>
                </div>
            <?php endif; ?>

            <form method="get" action="" style="margin-bottom: 20px;">
                <input type="hidden" name="page" value="<?php echo esc_attr($this->admin_page_slug); ?>" />
                <label for="mockmaster-preview-product"><strong>Preview product</strong></label>
                <select id="mockmaster-preview-product" name="preview_product_id">
                    <option value="0">Select a product</option>
                    <?php foreach ($products as $preview_product) : ?>
                        <option value="<?php echo esc_attr($preview_product->get_id()); ?>" <?php selected($selected_product_id, $preview_product->get_id()); ?>>
                            <?php echo esc_html($preview_product->get_name()); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
                <button class="button">Preview</button>
            </form>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin-bottom: 30px;">
                <?php wp_nonce_field('mockmaster_designer_save_settings'); ?>
                <input type="hidden" name="action" value="mockmaster_designer_save" />
                <input type="hidden" name="preview_product_id" value="<?php echo esc_attr($selected_product_id); ?>" />

                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="mockmaster-text-color">Text color</label></th>
                        <td><input type="color" id="mockmaster-text-color" name="settings[text_color]" value="<?php echo esc_attr($settings['text_color']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="mockmaster-stage-bg">Image stage background</label></th>
                        <td><input type="color" id="mockmaster-stage-bg" name="settings[stage_bg]" value="<?php echo esc_attr($settings['stage_bg']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="mockmaster-arc-color">Arc & border color</label></th>
                        <td><input type="color" id="mockmaster-arc-color" name="settings[arc_color]" value="<?php echo esc_attr($settings['arc_color']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="mockmaster-panel-bg">Panel background</label></th>
                        <td><input type="color" id="mockmaster-panel-bg" name="settings[panel_bg]" value="<?php echo esc_attr($settings['panel_bg']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="mockmaster-panel-border">Panel border</label></th>
                        <td><input type="color" id="mockmaster-panel-border" name="settings[panel_border]" value="<?php echo esc_attr($settings['panel_border']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="mockmaster-category-bg">Category background</label></th>
                        <td><input type="color" id="mockmaster-category-bg" name="settings[category_bg]" value="<?php echo esc_attr($settings['category_bg']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="mockmaster-category-active-bg">Category active background</label></th>
                        <td><input type="color" id="mockmaster-category-active-bg" name="settings[category_active_bg]" value="<?php echo esc_attr($settings['category_active_bg']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="mockmaster-category-active-text">Category active text</label></th>
                        <td><input type="color" id="mockmaster-category-active-text" name="settings[category_active_text]" value="<?php echo esc_attr($settings['category_active_text']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="mockmaster-swatch-active-bg">Swatch active background</label></th>
                        <td><input type="color" id="mockmaster-swatch-active-bg" name="settings[swatch_active_bg]" value="<?php echo esc_attr($settings['swatch_active_bg']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="mockmaster-swatch-active-text">Swatch active text</label></th>
                        <td><input type="color" id="mockmaster-swatch-active-text" name="settings[swatch_active_text]" value="<?php echo esc_attr($settings['swatch_active_text']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="mockmaster-accent">Accent color</label></th>
                        <td><input type="color" id="mockmaster-accent" name="settings[accent]" value="<?php echo esc_attr($settings['accent']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="mockmaster-button-bg">Primary button background</label></th>
                        <td><input type="color" id="mockmaster-button-bg" name="settings[button_bg]" value="<?php echo esc_attr($settings['button_bg']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="mockmaster-button-text">Primary button text</label></th>
                        <td><input type="color" id="mockmaster-button-text" name="settings[button_text]" value="<?php echo esc_attr($settings['button_text']); ?>" /></td>
                    </tr>
                </table>

                <?php submit_button('Save changes'); ?>
            </form>

            <h2>Preview</h2>
            <section class="mockmaster-designer" data-product-id="<?php echo esc_attr($selected_product_id); ?>" style="<?php echo esc_attr($style_attr); ?>">
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
        </div>
        <?php
    }

    public function handle_settings_save() {
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        check_admin_referer('mockmaster_designer_save_settings');

        $defaults = $this->get_default_settings();
        $input = isset($_POST['settings']) && is_array($_POST['settings']) ? $_POST['settings'] : array();
        $clean = array();

        foreach ($defaults as $key => $value) {
            $raw = isset($input[$key]) ? $input[$key] : $value;
            $clean[$key] = sanitize_hex_color($raw) ?: $value;
        }

        update_option($this->settings_option, $clean);

        $redirect_args = array(
            'page' => $this->admin_page_slug,
            'settings-updated' => 'true',
        );

        if (!empty($_POST['preview_product_id'])) {
            $redirect_args['preview_product_id'] = absint($_POST['preview_product_id']);
        }

        wp_safe_redirect(add_query_arg($redirect_args, admin_url('admin.php')));
        exit;
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

    private function get_preview_products() {
        if (!function_exists('wc_get_products')) {
            return array();
        }

        return wc_get_products(array(
            'limit' => 50,
            'status' => 'publish',
        ));
    }

    private function get_preview_product_id() {
        if (isset($_GET['preview_product_id'])) {
            return absint($_GET['preview_product_id']);
        }

        return 0;
    }

    private function get_preview_product() {
        if (!function_exists('wc_get_product')) {
            return null;
        }

        $product_id = $this->get_preview_product_id();
        if (!$product_id) {
            return null;
        }

        return wc_get_product($product_id);
    }

    private function get_default_settings() {
        return array(
            'text_color' => '#1a1a1a',
            'stage_bg' => '#f6f6f6',
            'arc_color' => '#1a1a1a',
            'panel_bg' => '#ffffff',
            'panel_border' => '#1a1a1a',
            'category_bg' => '#ffffff',
            'category_active_bg' => '#1a1a1a',
            'category_active_text' => '#ffffff',
            'swatch_active_bg' => '#1a1a1a',
            'swatch_active_text' => '#ffffff',
            'accent' => '#e01b24',
            'button_bg' => '#ffffff',
            'button_text' => '#e01b24',
        );
    }

    private function get_settings() {
        $defaults = $this->get_default_settings();
        $settings = get_option($this->settings_option, array());

        return array_merge($defaults, array_intersect_key($settings, $defaults));
    }

    private function get_css_variables_inline() {
        $settings = $this->get_settings();

        return sprintf(
            '--mm-text-color: %1$s; --mm-stage-bg: %2$s; --mm-arc-color: %3$s; --mm-panel-bg: %4$s; --mm-panel-border: %5$s; --mm-category-bg: %6$s; --mm-category-active-bg: %7$s; --mm-category-active-text: %8$s; --mm-swatch-active-bg: %9$s; --mm-swatch-active-text: %10$s; --mm-accent: %11$s; --mm-button-bg: %12$s; --mm-button-text: %13$s;',
            $settings['text_color'],
            $settings['stage_bg'],
            $settings['arc_color'],
            $settings['panel_bg'],
            $settings['panel_border'],
            $settings['category_bg'],
            $settings['category_active_bg'],
            $settings['category_active_text'],
            $settings['swatch_active_bg'],
            $settings['swatch_active_text'],
            $settings['accent'],
            $settings['button_bg'],
            $settings['button_text']
        );
    }

    private function build_css_variables() {
        return '.mockmaster-designer {' . $this->get_css_variables_inline() . '}';
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
                        'swatch' => $this->get_swatch_image_url($color),
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

    private function get_swatch_image_url($color_slug) {
        if (!taxonomy_exists('pa_color')) {
            return '';
        }

        $term = get_term_by('slug', $color_slug, 'pa_color');
        if (!$term || is_wp_error($term)) {
            return '';
        }

        $meta_keys = array(
            'swatch_image',
            'swatch_image_id',
            'product_attribute_swatch',
            'product_attribute_image',
            'attribute_image',
            'thumbnail_id',
        );

        foreach ($meta_keys as $key) {
            $value = get_term_meta($term->term_id, $key, true);
            if (!$value) {
                continue;
            }

            if (is_numeric($value)) {
                $image_url = wp_get_attachment_image_url((int) $value, 'thumbnail');
                if ($image_url) {
                    return $image_url;
                }
            }

            if (is_string($value) && filter_var($value, FILTER_VALIDATE_URL)) {
                return $value;
            }
        }

        return $this->resolve_ssp_image_url($term->term_id);
    }

    private function find_ssp_image($data) {
        if (is_numeric($data)) {
            $url = wp_get_attachment_url((int) $data);
            if ($url) {
                return $url;
            }
        }

        if (is_string($data)) {
            $string = trim($data);
            if (preg_match('#^https?://#i', $string)) {
                return $string;
            }
            if (preg_match('#https?://[^)\'"\\s]+#i', $string, $matches)) {
                return $matches[0];
            }
        }

        if (is_array($data)) {
            $preferred_keys = array(
                'image',
                'image_url',
                'img',
                'url',
                'src',
                'swatch',
                'swatch_image',
                'attachment_id',
                'id',
            );
            foreach ($preferred_keys as $key) {
                if (array_key_exists($key, $data)) {
                    $found = $this->find_ssp_image($data[$key]);
                    if ($found) {
                        return $found;
                    }
                }
            }
            foreach ($data as $value) {
                $found = $this->find_ssp_image($value);
                if ($found) {
                    return $found;
                }
            }
        }

        if (is_object($data)) {
            return $this->find_ssp_image((array) $data);
        }

        return '';
    }

    private function resolve_ssp_image_url($term_id) {
        $raw = get_term_meta($term_id, 'ssp_attribute_options_pa_color', true);
        if (!$raw) {
            return '';
        }

        $data = $raw;
        if (is_string($raw)) {
            $maybe = maybe_unserialize($raw);
            if ($maybe !== $raw) {
                $data = $maybe;
            }
        }

        return $this->find_ssp_image($data);
    }
}

new MockMasterDesigner();
