/**
 * @fileoverview Configuration settings for the development environment.
 */

/**
 * Environment-specific configuration variables for development.
 */
export const environment = {
  /**
   * Flag indicating that the application is running in development mode.
   */
  production: false,
  /**
   * The URL of the orchestrator service for the development environment.
   * @type {string}
   */
  orchestrator: 'http://localhost:3001'
};