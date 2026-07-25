/* repolis.config.js — the one fork-facing runtime configuration surface.
 *
 * Leave townOwner blank on GitHub Pages: a fork at <login>.github.io/<repo>
 * automatically becomes <login>'s town. For a custom domain, set townOwner.
 * Canonical AI/realtime services are intentionally disabled for every other
 * owner so a fork never spends or reports through the upstream deployment.
 */
(function () {
  const projectOwner = 'hyeonsangjeon';
  const townOwner = '';
  const loginPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
  const host = String(location.hostname || '').toLowerCase();
  const pagesMatch = host.match(/^([a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?)\.github\.io$/);
  const declared = loginPattern.test(townOwner) ? townOwner : '';
  const inferred = pagesMatch && loginPattern.test(pagesMatch[1]) ? pagesMatch[1] : '';
  const owner = declared || inferred || projectOwner;
  const canonical = owner.toLowerCase() === projectOwner;
  const local = /^(?:localhost|127\.0\.0\.1|::1)$/.test(host);
  const canonicalDev = local && window.REPOLIS_CANONICAL_DEV === true;
  const canonicalServices = canonical && (host === projectOwner + '.github.io' || canonicalDev || declared.toLowerCase() === projectOwner);

  window.REPOLIS_CONFIG = Object.freeze({
    project: Object.freeze({
      owner: projectOwner,
      repository: 'Repolis',
      url: 'https://github.com/hyeonsangjeon/Repolis',
      templateUrl: 'https://github.com/new?template_name=Repolis&template_owner=hyeonsangjeon',
    }),
    town: Object.freeze({
      owner,
      ownerKo: canonical ? '전현상' : owner,
      ownerEn: canonical ? 'Hyeon Sang Jeon' : owner,
      source: declared ? 'declared' : inferred ? 'github-pages' : 'upstream-default',
      canonical,
    }),
    services: Object.freeze({
      grounded: canonicalServices ? 'https://repolis-taxi.wingnut0310.workers.dev/' : '',
      realtime: canonicalServices ? 'wss://repolis-rt.wingnut0310.workers.dev' : '',
      analytics: canonicalServices ? 'https://repolis-metrics.wingnut0310.workers.dev/event' : '',
    }),
  });
})();
