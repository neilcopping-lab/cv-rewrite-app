/* The Com'mon People — shared mobile navigation.
   Turns the top menu into a clean hamburger on phones (<=820px).
   Desktop layout is left exactly as-is. Works on both the main site
   nav and the CV Rewrite app nav. Self-contained, no dependencies. */
(function () {
  var CSS = [
    '.cp-burger{display:none;flex-direction:column;justify-content:center;gap:5px;',
      'width:46px;height:46px;padding:9px;margin-left:auto;background:transparent;',
      'border:2px solid #e0b03c;border-radius:8px;cursor:pointer;flex:none;}',
    '.cp-burger span{display:block;height:3px;width:100%;background:#e0b03c;border-radius:3px;',
      'transition:transform .25s ease,opacity .2s ease;}',
    '.cp-nav-open .cp-burger span:nth-child(1){transform:translateY(8px) rotate(45deg);}',
    '.cp-nav-open .cp-burger span:nth-child(2){opacity:0;}',
    '.cp-nav-open .cp-burger span:nth-child(3){transform:translateY(-8px) rotate(-45deg);}',
    /* desktop: wrapper is invisible, children flow as before */
    '.cp-mnav-panel{display:contents;}',
    '@media(max-width:820px){',
      '.cp-burger{display:flex;}',
      /* force the bar to wrap so the menu panel drops full-width below the logo */
      '[data-cp-mob]{flex-wrap:wrap!important;}',
      '.cp-mnav-panel{display:block;flex-basis:100%;width:100%;order:99;',
        'overflow:hidden;max-height:0;transition:max-height .3s ease;}',
      '.cp-nav-open .cp-mnav-panel{max-height:80vh;overflow-y:auto;}',
      /* stack every group + its links vertically, full width */
      '.cp-mnav-panel > *{display:flex!important;flex-direction:column!important;',
        'align-items:stretch!important;gap:0!important;width:100%!important;padding:0!important;margin:0!important;}',
      '.cp-mnav-panel a{display:block!important;width:100%!important;box-sizing:border-box;',
        'padding:15px 4px!important;border-bottom:1px solid rgba(236,230,216,.14);',
        'font-size:16px!important;text-align:left;}',
      '.cp-mnav-panel a img{vertical-align:middle;margin-right:8px;}',
      /* neutralise the gold "Explore Resources" button so it reads as a row */
      '.cp-mnav-panel a[style*="background:#e0b03c"],.cp-mnav-panel a[style*="background:#E0B03C"]{',
        'background:transparent!important;color:#e0b03c!important;padding:15px 4px!important;letter-spacing:.06em;}',
      '.cp-mnav-panel > *:last-child a:last-child{border-bottom:0;}',
    '}'
  ].join('');

  function inject() {
    var s = document.createElement('style');
    s.id = 'cp-mobile-nav-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function build() {
    // Structure A: CV app  -> <nav class="nav">   Structure B: main site nav bar
    var bar = document.querySelector('nav.nav') ||
              document.querySelector('div[style*="border-bottom:3px solid #ece6d8"]');
    if (!bar || bar.dataset.cpMob) return;
    bar.dataset.cpMob = '1';

    var kids = Array.prototype.filter.call(bar.children, function (el) { return el.nodeType === 1; });
    if (kids.length < 2) return;
    var groups = kids.slice(1); // everything after the logo

    var panel = document.createElement('div');
    panel.className = 'cp-mnav-panel';
    groups.forEach(function (g) { panel.appendChild(g); });

    var btn = document.createElement('button');
    btn.className = 'cp-burger';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';

    bar.appendChild(btn);
    bar.appendChild(panel);

    btn.addEventListener('click', function () {
      var open = bar.classList.toggle('cp-nav-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        bar.classList.remove('cp-nav-open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  inject();
  if (document.readyState !== 'loading') build();
  else document.addEventListener('DOMContentLoaded', build);
})();
