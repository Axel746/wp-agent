<?php
/**
 * Plugin Name: WP Agent Studio Bridge
 * Description: Santé, capacités et journal minimal d’opérations autorisées pour WP Agent Studio.
 * Version: 0.1.0
 * Requires at least: 6.6
 * Requires PHP: 8.1
 * Author: WP Agent Studio
 * License: GPL-2.0-or-later
 * Text Domain: wp-agent-studio-bridge
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

final class WP_Agent_Studio_Bridge {
    private const NAMESPACE = 'wp-agent-studio/v1';
    private const LOG_OPTION = 'wp_agent_studio_operation_log';

    public static function boot(): void { add_action( 'rest_api_init', array( self::class, 'routes' ) ); }
    public static function routes(): void {
        register_rest_route( self::NAMESPACE, '/health', array( 'methods' => 'GET', 'callback' => array( self::class, 'health' ), 'permission_callback' => '__return_true' ) );
        register_rest_route( self::NAMESPACE, '/capabilities', array( 'methods' => 'GET', 'callback' => array( self::class, 'capabilities' ), 'permission_callback' => static fn (): bool => current_user_can( 'manage_options' ) ) );
        register_rest_route( self::NAMESPACE, '/operations', array( 'methods' => 'GET', 'callback' => array( self::class, 'operations' ), 'permission_callback' => static fn (): bool => current_user_can( 'manage_options' ) ) );
    }
    public static function health(): WP_REST_Response { return new WP_REST_Response( array( 'ok' => true, 'version' => '0.1.0', 'wordpress' => get_bloginfo( 'version' ) ), 200 ); }
    public static function capabilities(): WP_REST_Response {
        return new WP_REST_Response( array( 'content' => array( 'pages' => current_user_can( 'edit_pages' ), 'posts' => current_user_can( 'edit_posts' ), 'media' => current_user_can( 'upload_files' ) ), 'filesystem_write' => false, 'code_execution' => false ), 200 );
    }
    public static function operations(): WP_REST_Response { $log = get_option( self::LOG_OPTION, array() ); return new WP_REST_Response( is_array( $log ) ? array_slice( $log, -100 ) : array(), 200 ); }
    public static function record( string $operation, string $resource, string $idempotency_key, array $result ): void {
        $allowed = array( 'page.create', 'page.update', 'post.create', 'post.update', 'media.upload', 'health.read' );
        if ( ! in_array( $operation, $allowed, true ) ) { return; }
        $log = get_option( self::LOG_OPTION, array() ); if ( ! is_array( $log ) ) { $log = array(); }
        $log[] = array( 'operation' => sanitize_key( $operation ), 'resource' => sanitize_text_field( $resource ), 'idempotencyKey' => sanitize_text_field( $idempotency_key ), 'result' => wp_json_encode( $result ), 'userId' => get_current_user_id(), 'createdAt' => gmdate( 'c' ) );
        update_option( self::LOG_OPTION, array_slice( $log, -500 ), false );
    }
}
WP_Agent_Studio_Bridge::boot();
