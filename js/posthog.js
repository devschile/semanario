(function initializePostHog() {
  const config = window.__POSTHOG_CONFIG__;
  const missingVariable = !config?.token || config.token.startsWith('__')
    ? 'POSTHOG_PROJECT_TOKEN'
    : !config.host || config.host.startsWith('__')
      ? 'POSTHOG_HOST'
      : null;

  if (missingVariable) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      throw new Error(`${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`);
    }
    return;
  }

  window.posthog = window.posthog || [];
  window.posthog._i = window.posthog._i || [];
  const methods = 'capture identify reset register unregister group getFeatureFlag isFeatureEnabled startExceptionAutocapture'.split(' ');
  methods.forEach((method) => {
    window.posthog[method] = function (...args) {
      window.posthog.push([method, ...args]);
    };
  });
  window.posthog.init = function (token, options) {
    window.posthog._i.push([token, options]);
  };

  window.posthog.init(config.token, {
    api_host: config.host,
    defaults: '2026-05-30',
  });
  window.posthog.startExceptionAutocapture();

  const script = document.createElement('script');
  script.async = true;
  script.src = config.host.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js';
  document.head.appendChild(script);
})();
