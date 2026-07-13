<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
add_action( 'after_setup_theme', static function (): void { load_theme_textdomain( 'wp-agent-studio-example', get_template_directory() . '/languages' ); add_theme_support( 'wp-block-styles' ); } );
