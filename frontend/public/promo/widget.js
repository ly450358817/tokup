(function() {
  var script = document.currentScript;
  var theme = script.getAttribute('data-theme') || 'dark';
  var position = script.getAttribute('data-position') || 'bottom-right';
  
  var container = document.createElement('div');
  container.id = 'tokup-badge';
  container.style.cssText = [
    'position:fixed',
    position.includes('bottom') ? 'bottom:20px' : 'top:20px',
    position.includes('right') ? 'right:20px' : 'left:20px',
    'z-index:999999',
    'font-family:Inter,-apple-system,sans-serif',
    'transition:all 0.3s ease',
  ].join(';');
  
  container.innerHTML = '<a href="https://tokup.net/?ref=badge" target="_blank" rel="noopener" style="' +
    'display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:12px;' +
    'text-decoration:none;font-size:13px;font-weight:500;transition:all 0.2s;' +
    (theme === 'dark' 
      ? 'background:rgba(10,10,15,0.85);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.08);color:#fff;' 
      : 'background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border:1px solid rgba(0,0,0,0.08);color:#1a1a1a;box-shadow:0 4px 20px rgba(0,0,0,0.08);') +
    '" onmouseover="this.style.transform=\'scale(1.03)\'" onmouseout="this.style.transform=\'scale(1)\'">' +
    '<span style="width:24px;height:24px;border-radius:6px;background:rgba(16,185,129,0.15);display:flex;align-items:center;justify-content:center;color:#10B981;font-weight:700;font-size:14px;">T</span>' +
    '<span>TokUp <span style="color:#10B981">·</span> 脉充</span>' +
    '<span style="font-size:11px;opacity:0.5;margin-left:4px;">AI API Proxy</span>' +
    '</a>';
  
  document.body.appendChild(container);
})();
